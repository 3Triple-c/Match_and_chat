import Match from "../models/Match.js";
import User from "../models/User.js";
import Group from "../models/Group.js";
import { getIO } from "../middleware/socket.js";

// convert to id
const toId = v => (v && v._id ? v._id : v);
// check if id is equal(the same)
const idEq = (a, b) => toId(a)?.toString() === toId(b)?.toString();

const MAX_GROUP_SIZE = 10;
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
    if (availableUsers.length < 3) {
      return res
        .status(400)
        .json({ message: "Not enough users to create a match." });
    }

    // const groupedByStudyTime = {};
    // availableUsers.forEach(u => {
    //   if (!groupedByStudyTime[u.studyTime]) {
    //     groupedByStudyTime[u.studyTime] = [];
    //   }
    //   groupedByStudyTime[u.studyTime].push(u);
    // });

    // for (const studyTime in groupedByStudyTime) {
    //   const usersInSameTime = groupedByStudyTime[studyTime];
    // }
    const scores = [];

    // check for same interest from users witih the same studuytime
    for (let i = 0; i < availableUsers.length; i++) {
      for (let j = i + 1; j < availableUsers.length; j++) {
        const userA = availableUsers[i];
        const userB = availableUsers[j];
        // const { score, shared } = calculateCompactibility(userA, userB);

        const interestA = Array.isArray(userA.interest) ? userA.interest : [];
        const interestB = Array.isArray(userB.interest) ? userB.interest : [];
        const sharedInterests = interestA.filter(i => interestB.includes(i));
        // const sharedInterests = userA.interest.filter(interest =>
        //   userB.interest.includes(interest),
        // );
        let score = 0;
        if (userA.studyTime === userB.studyTime) score += 5;
        score += sharedInterests.length * 2;
        scores.push({ userA, userB, score, sharedInterests });
      }
    }
    const qualifyingScores = scores.filter(s => s.score > QUALIFYING_SCORE);
    scores.sort((a, b) => b.score - a.score);
    if (scores.length === 0) {
      return res.status(400).json({ message: "No compactable users founnd." });
    }

    const qualifiedUserIds = [
      ...new Set(
        qualifyingScores.flatMap(s => [
          s.userA._id.toString(),
          s.userB._id.toString(),
        ]),
      ),
    ];
    if (qualifiedUserIds.length < 3) {
      return res
        .status(400)
        .json({ message: "Not enough compatible users to create a match" });
    }
    const finalUsers = availableUsers.filter(u =>
      qualifiedUserIds.includes(u._id.toString()),
    );

    if (finalUsers.some(u => !u._id)) {
      return res
        .status(400)
        .json({ message: "Invalid user detected during matching" });
    }

    console.log(
      "FINAL USERS:",
      finalUsers.map(u => ({ id: u?._id, interest: u?.interest })),
    );
    // create matchrequestwith those users
    const matchRequest = await Match.create({
      users: finalUsers.map(u => ({
        user: u._id,
        status: "pending",
      })),
      compactibiltyScores: scores.slice(0, 10).map(s => ({
        users: [s.userA._id, s.userB._id],
        score: s.score,
        sharedInterests: s.sharedInterests,
      })),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), //24 hours expiry
      isGroupCreated: false,
      isActive: true,
    });
    const io = getIO();

    matchRequest.users.forEach(u => {
      if (!u.user) return;
      io.to(u.user.toString()).emit("match:created", {
        matchId: matchRequest._id,
      });
    });
    const populatedMatch = await Match.findById(matchRequest._id)
      .populate("users.user", "email")
      .populate("compactibiltyScores.users", "email");
    res.status(201).json({
      message: "match request created with scorer",
      matchRequest: populatedMatch,
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

    if (acceptedUsers.length >= MIN_GROUP_SIZE && !match.isGroupCreated) {
      group = await Group.create({
        name: `Study Group on ${new Date()
          .toISOString()
          .slice(0, 16)
          .replace("T", "")}`,
        topic: "Study",
        members: acceptedUsers,
        createBy: acceptedUsers[0],
        isActive: true,
      });
      match.isGroupCreated = true;
      match.groupId = group._id;
      await match.save();
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
export const getMyActiveMatch = async (req, res) => {
  try {
    const userId = req.user._id;
    console.log("ACTIVE MATCH CHECK USER:", userId.toString());

    const match = await Match.findOne({
      "users.user": userId,
      isActive: true,
    });
    if (!match) {
      return res.status(404).json({ message: "No Active MAtch fouund" });
    }
    await match.populate("users.user", "name email");

    console.log("MATCH FOUND:", match?._id || null);
    // const populatedMatch = await Match.findById(match?._id).populate(
    //   "users.user",
    //   "email",
    // );
    return res.json(match);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch active Match" });
  }
};
