import Match from "../models/Match.js";
import User from "../models/User.js";
import Group from "../models/Group.js";
import { getIO } from "../middleware/socket.js";

// convert to id
const toId = v => (v && v._id ? v._id : v);
// check if id is equal(the same)
const idEq = (a, b) => toId(a)?.toString() === toId(b)?.toString();

const MAX_GROUP_SIZE = 6;
const MIN_GROUP_SIZE = 3;
const QUALIFYING_SCORE = 5;
// calculate and score compactibilty between users
function calculateCompactibility(userA, userB) {
  let score = 0;
  if (userA.studyTime === userB.studyTime) score += 5;

  const shared = userA.interest.filter(i => userB.interest.includes(i));
  score += shared.length * 2;

  if (userA.level && userB.level && userA.level === userB.level) score += 3;
  return { score, shared };
}

const buildScores = users => {
  const scores = [];
  for (let i = 0; i < users.length; i++) {
    for (let j = i + 1; j < users.length; j++) {
      const userA = users[i];
      const userB = users[j];
      const interestA = Array.isArray(userA.interest) ? userA.interest : [];
      const interestB = Array.isArray(userB.interest) ? userB.interest : [];
      const sharedInterests = interestA.filter(i => interestB.includes(i));
      let score = 0;
      if (userA.studyTime === userB.studyTime) score += 5;
      score += sharedInterests.length * 2;
      scores.push({ userA, userB, score, sharedInterests });
    }
  }
  return scores;
};

const buildAdjacency = (users, scores, threshold) => {
  const adjacency = new Map();
  users.forEach(u => {
    adjacency.set(u._id.toString(), new Set());
  });
  scores.forEach(s => {
    if (s.score > threshold) {
      const a = s.userA._id.toString();
      const b = s.userB._id.toString();
      adjacency.get(a)?.add(b);
      adjacency.get(b)?.add(a);
    }
  });
  return adjacency;
};

const getConnectedComponents = (users, adjacency) => {
  const visited = new Set();
  const components = [];
  for (const user of users) {
    const id = user._id.toString();
    if (visited.has(id)) continue;
    const stack = [id];
    const componentIds = [];
    visited.add(id);
    while (stack.length) {
      const current = stack.pop();
      componentIds.push(current);
      const neighbors = adjacency.get(current);
      if (!neighbors) continue;
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          stack.push(neighbor);
        }
      }
    }
    const componentUsers = users.filter(u =>
      componentIds.includes(u._id.toString()),
    );
    components.push(componentUsers);
  }
  return components;
};

const splitIntoGroups = (component, adjacency) => {
  const degree = user => adjacency.get(user._id.toString())?.size || 0;
  const sorted = [...component].sort((a, b) => {
    const diff = degree(b) - degree(a);
    if (diff !== 0) return diff;
    return a._id.toString().localeCompare(b._id.toString());
  });
  const groups = [];
  for (let i = 0; i < sorted.length; i += MAX_GROUP_SIZE) {
    groups.push(sorted.slice(i, i + MAX_GROUP_SIZE));
  }
  return groups;
};

const formatMatchName = bucketKey => {
  const now = new Date();
  const pad = n => String(n).padStart(2, "0");
  const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(
    now.getDate(),
  )}`;
  const time = `${pad(now.getHours())}-${pad(now.getMinutes())}`;
  return `${bucketKey}_${date}_${time}`;
};

// system create match
//  run the matching algorithm
export const runMatchingAlgorithm = async (req, res) => {
  try {
    const COOLDOWN_TIME = 30 * 60 * 1000;
    //finding rthe available users
    const availableUsers = await User.find({
      isAvailable: true,
      // groupId: null,
      // groups:{$size:0},
      $or: [
        { lastLeftGroupAt: null },
        { lastLeftGroupAt: { $lte: new Date(Date.now() - COOLDOWN_TIME) } },
      ],
    });
    if (availableUsers.length < MIN_GROUP_SIZE) {
      return res
        .status(400)
        .json({ message: "Not enough users to create a match." });
    }

    const buckets = new Map();
    availableUsers.forEach(u => {
      const key = u.primaryInterest?.toLowerCase();
      if (!key) return;
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(u);
    });

    const createdMatches = [];
    const io = getIO();

    for (const [bucketKey, users] of buckets) {
      if (users.length < MIN_GROUP_SIZE) continue;
      console.log(
        `MATCH BUCKET ${bucketKey}: ${users.length} users`,
        users.map(u => u._id?.toString()),
      );
      const scores = buildScores(users);
      scores.sort((a, b) => b.score - a.score);
      if (scores.length === 0) continue;

      const adjacency = buildAdjacency(users, scores, QUALIFYING_SCORE);
      const components = getConnectedComponents(users, adjacency);
      console.log(
        `MATCH COMPONENTS ${bucketKey}: ${components.length}`,
        components.map(c => c.length),
      );

      for (const component of components) {
        if (component.length < MIN_GROUP_SIZE) continue;
        const groups = splitIntoGroups(component, adjacency);
        console.log(
          `MATCH GROUPS ${bucketKey}: ${groups.length}`,
          groups.map(g => g.length),
        );
        for (const groupUsers of groups) {
          if (groupUsers.length < MIN_GROUP_SIZE) continue;
          const groupIds = new Set(groupUsers.map(u => u._id.toString()));
          const groupScores = scores.filter(
            s =>
              groupIds.has(s.userA._id.toString()) &&
              groupIds.has(s.userB._id.toString()),
          );
          const matchName = formatMatchName(bucketKey);
          const matchRequest = await Match.create({
            name: matchName,
            users: groupUsers.map(u => ({
              user: u._id,
              status: "pending",
            })),
            compactibiltyScores: groupScores.slice(0, 10).map(s => ({
              users: [s.userA._id, s.userB._id],
              score: s.score,
              sharedInterests: s.sharedInterests,
            })),
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
            isGroupCreated: false,
            isActive: true,
          });
          createdMatches.push(matchRequest);

          const groupUserIds = groupUsers.map(u => u._id);
          await Match.updateMany(
            {
              isActive: true,
              _id: { $ne: matchRequest._id },
              "users.user": { $in: groupUserIds },
            },
            { $set: { isActive: false } },
          );

          matchRequest.users.forEach(u => {
            if (!u.user) return;
            io.to(u.user.toString()).emit("match:created", {
              matchId: matchRequest._id,
            });
          });
        }
      }
    }

    if (createdMatches.length === 0) {
      return res.status(400).json({ message: "No compatible users found." });
    }

    const populatedMatches = await Match.find({
      _id: { $in: createdMatches.map(m => m._id) },
    })
      .populate("users.user", "email")
      .populate("compactibiltyScores.users", "email");

    res.status(201).json({
      message: "match requests created",
      matchRequests: populatedMatches,
    });
  } catch (err) {
    console.error("Error running match algorithm", err);
    res.status(500).json({ message: "Error running match algorithm" });
  }
};
// change isAtive if match is expired

const refreshExpiry = async match => {
  const expiresAt = match.expiresAt;
  if (expiresAt && new Date(expiresAt) < new Date() && match.isActive) {
    match.isActive = false;
    await match.save();
  }
  return match;
};
// accept match

export const acceptMatch = async (req, res) => {
  try {
    const { matchId } = req.body;
    const userId = req.user._id;
    const io = getIO();
    const match = await Match.findById(matchId);
    if (!match) {
      return res.status(404).json({ message: "Match request not found" });
    }
    // expiry check
    await refreshExpiry(match);

    if (!match.isActive) {
      return res
        .status(400)
        .json({ message: "This match request has expired" });
    }
    // check if user is part of this match

    const userEntry = match.users.find(u => idEq(u.user, userId));
    if (!userEntry) {
      return res.status(404).json({ message: "User not part of this match" });
    }

    //if already accepted
    if (userEntry.status === "accepted") {
      const user = await Match.findById(match._id).populate(
        "users.user",
        "email groups",
      );
      return res
        .status(200)
        .json({ message: "User already accepted", match: user, group: null });
    }
    // update staus
    userEntry.status = "accepted";
    await match.save();
    const acceptedUsers = match.users
      .filter(u => u.status === "accepted")
      .map(u => toId(u.user));
    //create group
    let group = null;
    // adding a new member to the group if the group already exists
    if (match.isGroupCreated && match.groupId) {
      group = await Group.findById(match.groupId);
      if (!group) {
        return res
          .status(500)
          .json({ message: "Group data missing, inconsistency detected" });
      }
      // prevent double entry
      const alreadyMember = group.members.some(m => idEq(m, userId));
      if (!alreadyMember) {
        const updated = await Group.findOneAndUpdate(
          {
            _id: match.groupId,
            members: { $ne: userId },
            $expr: { $lt: [{ $size: "$members" }, MAX_GROUP_SIZE] },
          },
          {
            $addToSet: { members: userId },
          },
          { new: true },
        );

        if (!updated) {
          return res
            .status(400)
            .json({ message: "Group is already full", match: user, group });
        }
        // if (group.members.length >= MAX_GROUP_SIZE) {
        //   const user = await Match.findById(match._id).populate(
        //     "users.user",
        //     "name groupId"
        //   );
        //   return res
        //     .status(400)
        //     .json({ message: "Group is already full", match: user, group });
        // }
        // group.members.push(userId);
        // await group.save();
        // update user's groupIf
        await User.findByIdAndUpdate(userId, {
          $addToSet: { groups: group._id },
          $set: { isAvailable: false },
        });
      }
    }

    let groupCreatedNow = false;
    if (acceptedUsers.length >= MIN_GROUP_SIZE && !match.isGroupCreated) {
      const matchName = match.name || formatMatchName("group");
      group = await Group.create({
        internalName: matchName,
        name: matchName,
        topic: "Study",
        members: acceptedUsers,
        createBy: acceptedUsers[0],
        isActive: true,
      });
      match.isGroupCreated = true;
      match.groupId = group._id;
      await match.save();
      groupCreatedNow = true;
      //update user groupId
      await User.updateMany(
        { _id: { $in: acceptedUsers } },
        { $addToSet: { groups: group._id }, $set: { isAvailable: false } },
      );
    }
    const user = await Match.findById(match._id).populate(
      "users.user",
      "email groups",
    );
    const freshGroup = match.groupId
      ? await Group.findById(match.groupId)
      : group;
    if (groupCreatedNow && io) {
      match.users.forEach(u => {
        if (!u.user) return;
        io.to(u.user.toString()).emit("group:created", {
          matchId: match._id,
          groupId: group?._id,
          name: group?.name,
        });
      });
    }

    res.status(200).json({
      message: freshGroup
        ? "group created/updated successfully"
        : "Match accepted,waiting for others",
      match: user,
      group: freshGroup || null,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error accepting match" });
  }
};

// Reject a match
export const rejectMatch = async (req, res) => {
  try {
    const { matchId } = req.body;
    const userId = req.user._id;
    const io = getIO();

    const match = await Match.findById(matchId);
    if (!match) {
      return res.status(404).json({ message: "Match request not found" });
    }
    // expiry check
    await refreshExpiry(match);

    if (!match.isActive) {
      return res.status(400).json({ message: "This match has expired." });
    }
    // checking if user is part of this match
    const userEntry = match.users.find(u => idEq(u.user, userId));
    if (!userEntry) {
      return res.status(400).json({ message: "User not in match" });
    }

    if (userEntry.status === "rejected") {
      return res.status(200).json({ message: "User already rejected", match });
    }

    // update staus
    userEntry.status = "rejected";
    await match.save();

    // check if match can forom group
    const acceptedCount = match.users.filter(
      u => u.status === "accepted",
    ).length;
    const pendingCount = match.users.filter(u => u.status === "pending").length;
    const canStillFormGroup = acceptedCount + pendingCount >= MIN_GROUP_SIZE;

    // if can't form a group close match and notify user
    if (!canStillFormGroup) {
      match.isActive = false;
      await match.save();

      match.users.forEach(u => {
        io.to(u.user.toString()).emit("match:failed", {
          matchId: match._id,
          reason: "Not enough participant to form a group",
        });
      });
      return res.status(200).json({
        message: "Match closed. not enough participants to form a group",

        match,
      });
    }
    return res.status(200).json({
      message: "User rejected. waiting for others",
      match,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Error rejecting match" });
  }
};

// Geting all match requests for a user
export const getUserMatches = async (req, res) => {
  try {
    const matches = await Match.find({ "users.user": req.user.id })
      .populate("users.user", "name email")
      .populate("topic");
    return res
      .status(200)
      .json({ message: "user match requests are", matches });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error fetching matches" });
  }
};

// getting a users active match
export const getMyActiveMatches = async (req, res) => {
  try {
    const userId = req.user._id;
    console.log("ACTIVE MATCH CHECK USER:", userId.toString());

    const matches = await Match.find({
      "users.user": userId,
      isActive: true,
    })
      .sort({ createdAt: -1 })
      .populate("users.user", "name email");

    if (!matches || matches.length === 0) {
      return res.status(404).json({ message: "No Active Match found" });
    }

    console.log(
      "MATCHES FOUND:",
      matches.map(m => m?._id?.toString()),
    );
    return res.json(matches);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch active Match" });
  }
};
