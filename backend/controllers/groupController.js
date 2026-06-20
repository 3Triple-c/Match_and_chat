import Group from "../models/Group.js";
import User from "../models/User.js";
import Match from "../models/Match.js";
import {
  buildStudyTimeOptions,
  normalizeStudyTime,
} from "../utils/studyTime.js";

const NEXT_SESSION_VOTE_WINDOW_MS = 6 * 60 * 60 * 1000;

const populateGroupQuery = groupId =>
  Group.findById(groupId)
    .populate(
      "members",
      "name email studyTime interest level isOnlineOnApp lastSeenOnAppAt",
    )
    .populate("createBy", "name email isOnlineOnApp lastSeenOnAppAt")
    .populate("nextSessionPlan.teacherUser", "name email primaryInterest")
    .populate("nextSessionPlan.finalizedBy", "name email")
    .populate("nextSessionPlan.votes.user", "name email");

const getGroupForMember = async (groupId, userId) => {
  const user = await User.findById(userId);
  if (!user?.groups?.includes(groupId)) {
    return { status: 403, message: "Access is denied to this group" };
  }

  const group = await Group.findById(groupId);
  if (!group) {
    return { status: 404, message: "Group not found" };
  }

  return { group };
};

const inferMajorStudyTime = async group => {
  const fullGroup = await Group.findById(group._id).populate(
    "members",
    "studyTime",
  );
  const counts = new Map();
  for (const member of fullGroup?.members || []) {
    const key = normalizeStudyTime(member.studyTime || "evening") || "evening";
    counts.set(key, (counts.get(key) || 0) + 1);
  }

  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "evening";
};

const ensureCreator = (group, userId) =>
  group.createBy?.toString() === userId.toString();

const cloneNextSessionPlan = group => ({
  topic: group.nextSessionPlan?.topic || "",
  prepNotes: group.nextSessionPlan?.prepNotes || "",
  sourceType: group.nextSessionPlan?.sourceType || "topic",
  sourceLabel: group.nextSessionPlan?.sourceLabel || "",
  sourceLink: group.nextSessionPlan?.sourceLink || "",
  sourceText: group.nextSessionPlan?.sourceText || "",
  listedTimeOptions: group.nextSessionPlan?.listedTimeOptions || [],
  votes: group.nextSessionPlan?.votes || [],
  teacherUser: group.nextSessionPlan?.teacherUser || null,
  scheduledFor: group.nextSessionPlan?.scheduledFor || null,
  finalizedAt: group.nextSessionPlan?.finalizedAt || null,
  voteWindowEndsAt: group.nextSessionPlan?.voteWindowEndsAt || null,
  finalizedBy: group.nextSessionPlan?.finalizedBy || null,
  teacherRevealedAt: group.nextSessionPlan?.teacherRevealedAt || null,
  isPinned: group.nextSessionPlan?.isPinned ?? true,
  planStatus: group.nextSessionPlan?.planStatus || "draft",
});

const findWinningOption = listedTimeOptions => {
  const sorted = [...listedTimeOptions].sort((a, b) => {
    const voteDelta = (b.voteCount || 0) - (a.voteCount || 0);
    if (voteDelta !== 0) return voteDelta;
    return new Date(a.value).getTime() - new Date(b.value).getTime();
  });

  const bestCount = sorted[0]?.voteCount || 0;
  const tied = sorted.filter(option => (option.voteCount || 0) === bestCount);
  if (!tied.length) return null;
  return tied[Math.floor(Math.random() * tied.length)];
};

const finalizePlanIfReady = group => {
  const votes = group.nextSessionPlan?.votes || [];
  const memberCount = group.members?.length || 0;
  const participationRate = memberCount === 0 ? 0 : votes.length / memberCount;
  const everyoneVoted = memberCount > 0 && votes.length >= memberCount;
  const voteWindowExpired =
    !!group.nextSessionPlan?.voteWindowEndsAt &&
    new Date(group.nextSessionPlan.voteWindowEndsAt).getTime() <= Date.now();

  if (!everyoneVoted && !voteWindowExpired) {
    return false;
  }

  if (participationRate < 0.5) {
    group.nextSessionPlan.planStatus = "needs_update";
    group.nextSessionPlan.scheduledFor = null;
    group.nextSessionPlan.finalizedAt = null;
    group.nextSessionPlan.finalizedBy = null;
    group.nextSessionPlan.voteWindowEndsAt = null;
    return true;
  }

  const winner = findWinningOption(
    group.nextSessionPlan.listedTimeOptions || [],
  );
  group.nextSessionPlan.scheduledFor = winner?.value || null;
  group.nextSessionPlan.finalizedAt = new Date();
  group.nextSessionPlan.planStatus = "finalized";
  group.nextSessionPlan.voteWindowEndsAt = null;
  return true;
};

export const getGroupDetails = async (req, res) => {
  try {
    const userId = req.user._id;
    const groupId = req.query.groupId || req.body.groupId;
    if (!groupId) {
      return res.status(400).json({ message: "Group ID is required" });
    }

    const access = await getGroupForMember(groupId, userId);
    if (access.message) {
      return res.status(access.status).json({ message: access.message });
    }

    const group = await populateGroupQuery(groupId);
    res.status(200).json(group);
  } catch (err) {
    res.status(500).json({ message: "error fetching group details" });
  }
};

export const leaveGroup = async (req, res) => {
  try {
    const userId = req.user._id;
    const { groupId } = req.body;

    const user = await User.findById(userId);
    if (!user.groups.includes(groupId)) {
      return res.status(400).json({ message: "user is not in this group" });
    }
    const group = await Group.findById(groupId);

    if (!group) {
      await User.findByIdAndUpdate(userId, {
        $pull: { groups: groupId },
        lastLeftGroupAt: new Date(),
      });

      return res.status(404).json({ message: "Group missing, user cleaned" });
    }

    await Group.findByIdAndUpdate(groupId, {
      $pull: { members: userId },
    });

    await User.findByIdAndUpdate(userId, {
      $pull: { groups: groupId },
      lastLeftGroupAt: new Date(),
    });

    const updatedGroup = await Group.findById(groupId);
    if (updatedGroup?.members?.length < 3) {
      await User.updateMany(
        { _id: { $in: updatedGroup.members } },
        {
          $pull: { groups: groupId },
          $set: { lastLeftGroupAt: new Date() },
        },
      );
      await Group.findByIdAndUpdate(groupId, {
        $set: { isActive: false },
      });
    }

    res.status(200).json({ message: "left group successfully" });
  } catch (err) {
    res.status(500).json({ message: "error leaving group" });
  }
};

export const rateGroup = async (req, res) => {
  try {
    const userId = req.user._id;
    const { groupId, rating, comment } = req.body;

    const numericRating = Number(rating);
    if (isNaN(numericRating)) {
      return res
        .status(400)
        .json({ message: "rating is required and must be a number" });
    }
    if (numericRating < 1 || numericRating > 5) {
      return res
        .status(400)
        .json({ message: "Rating must be between 1 and 5" });
    }

    const user = await User.findById(userId);
    if (!user.groups.includes(groupId)) {
      return res.status(404).json({ message: "Not a group memeber" });
    }

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: "group not found" });
    }
    if (group.feedbacks.some(fb => fb.user.equals(userId))) {
      return res.status(400).json({ message: "you already rated this group" });
    }

    group.feedbacks.push({ user: userId, rating: numericRating, comment });
    await group.save();

    res.status(200).json({ message: "feedback Submitted" });
  } catch (err) {
    res.status(500).json({ message: "server error submitting feedback" });
  }
};

export const deleteGroup = async (req, res) => {
  try {
    const userId = req.user._id;
    const { groupId } = req.body;
    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }
    if (group.createBy.toString() !== userId.toString()) {
      return res
        .status(403)
        .json({ message: "Only the creator can delete this group" });
    }
    if (group.isActive && group.members.length >= 3) {
      return res.status(400).json({
        message:
          "Only inactive groups can be deleted from the creator dashboard",
      });
    }
    await Group.findByIdAndDelete(groupId);
    await User.updateMany(
      { _id: { $in: group.members } },
      {
        $pull: { groups: groupId },
        $set: { isAvailable: true, lastLeftGroupAt: new Date() },
      },
    );
    await Match.updateMany(
      { groupId },
      { $set: { isActive: false, isGroupCreated: false } },
    );
    res.json({ message: "Group deleted and users updated" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "error deleting group", err });
  }
};

export const updateGroupName = async (req, res) => {
  try {
    const userId = req.user._id;
    const { groupId, name } = req.body;
    if (!groupId || !name) {
      return res.status(400).json({ message: "groupId and name are required" });
    }
    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }
    if (group.createBy.toString() !== userId.toString()) {
      return res.status(403).json({ message: "Only creator can rename group" });
    }
    group.name = name.trim();
    await group.save();
    const populated = await populateGroupQuery(groupId);
    res.status(200).json(populated);
  } catch (err) {
    res.status(500).json({ message: "error updating group name" });
  }
};

export const getMyGroups = async (req, res) => {
  try {
    const userId = req.user._id;
    const groups = await Group.find({
      members: userId,
    })
      .select(
        "_id name members createdAt topic studyStreak longestStudyStreak nextSessionPlan sessionSettings isActive",
      )
      .populate("nextSessionPlan.teacherUser", "name email");

    res.status(200).json(groups);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch groups" });
  }
};

export const clearNextSessionPlan = async (req, res) => {
  try {
    const userId = req.user._id;
    const { groupId } = req.body;
    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }
    if (!ensureCreator(group, userId)) {
      return res.status(403).json({
        message: "Only the creator can clear the planned next session",
      });
    }

    group.nextSessionPlan = {
      ...cloneNextSessionPlan(group),
      topic: "",
      prepNotes: "",
      sourceType: "topic",
      sourceLabel: "",
      sourceLink: "",
      sourceText: "",
      listedTimeOptions: [],
      votes: [],
      scheduledFor: null,
      finalizedAt: null,
      voteWindowEndsAt: null,
      finalizedBy: null,
      isPinned: false,
      planStatus: "draft",
    };

    await group.save();
    const populated = await populateGroupQuery(groupId);
    res.status(200).json(populated);
  } catch (err) {
    res.status(500).json({ message: "Failed to clear planned next session" });
  }
};

export const updateNextSessionPlan = async (req, res) => {
  try {
    const userId = req.user._id;
    const {
      groupId,
      topic = "",
      prepNotes = "",
      sourceType = "topic",
      sourceLabel = "",
      sourceLink = "",
      sourceText = "",
    } = req.body;

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }
    if (!ensureCreator(group, userId)) {
      return res.status(403).json({
        message: "Only the creator can update the planned next session",
      });
    }

    const majorStudyTime = await inferMajorStudyTime(group);
    const listedTimeOptions = buildStudyTimeOptions(majorStudyTime).map(
      option => ({
        label: option.label,
        value: option.value,
        voteCount: 0,
      }),
    );

    group.nextSessionPlan = {
      ...cloneNextSessionPlan(group),
      topic: topic.trim(),
      prepNotes: prepNotes.trim(),
      sourceType,
      sourceLabel: sourceLabel.trim(),
      sourceLink: sourceLink.trim(),
      sourceText: sourceText.trim(),
      listedTimeOptions,
      votes: [],
      scheduledFor: null,
      finalizedAt: null,
      finalizedBy: null,
      voteWindowEndsAt: new Date(Date.now() + NEXT_SESSION_VOTE_WINDOW_MS),
      isPinned: true,
      planStatus: "voting",
    };

    await group.save();
    const populated = await populateGroupQuery(groupId);
    res.status(200).json(populated);
  } catch (err) {
    res.status(500).json({ message: "Failed to update planned next session" });
  }
};

export const voteNextSessionTime = async (req, res) => {
  try {
    const userId = req.user._id;
    const { groupId, value, confirm = true } = req.body;
    if (!confirm) {
      return res
        .status(400)
        .json({ message: "Confirm the vote before submitting it" });
    }

    const access = await getGroupForMember(groupId, userId);
    if (access.message) {
      return res.status(access.status).json({ message: access.message });
    }

    const group = access.group;
    if (!group.nextSessionPlan?.listedTimeOptions?.length) {
      return res
        .status(400)
        .json({ message: "There is no active time vote yet" });
    }
    if (group.nextSessionPlan.planStatus === "finalized") {
      return res
        .status(400)
        .json({ message: "This next session plan is already finalized" });
    }

    const existingVote = group.nextSessionPlan.votes.find(
      vote => vote.user.toString() === userId.toString(),
    );
    if (existingVote) {
      return res
        .status(400)
        .json({ message: "You have already voted for this session plan" });
    }

    const selectedOption = group.nextSessionPlan.listedTimeOptions.find(
      option =>
        new Date(option.value).toISOString() === new Date(value).toISOString(),
    );
    if (!selectedOption) {
      return res
        .status(400)
        .json({ message: "That time option is not available" });
    }

    group.nextSessionPlan.votes.push({
      user: userId,
      time: selectedOption.value,
      votedAt: new Date(),
    });
    group.nextSessionPlan.listedTimeOptions =
      group.nextSessionPlan.listedTimeOptions.map(option => ({
        ...(option.toObject ? option.toObject() : option),
        voteCount:
          new Date(option.value).toISOString() ===
          new Date(selectedOption.value).toISOString()
            ? (option.voteCount || 0) + 1
            : option.voteCount || 0,
      }));

    finalizePlanIfReady(group);
    await group.save();

    const populated = await populateGroupQuery(groupId);
    res.status(200).json(populated);
  } catch (err) {
    res
      .status(500)
      .json({ message: "Failed to vote for the next session time" });
  }
};

export const finalizeNextSessionPlan = async (req, res) => {
  try {
    const userId = req.user._id;
    const { groupId } = req.body;
    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }
    if (!ensureCreator(group, userId)) {
      return res.status(403).json({
        message: "Only the creator can finalize the planned next session",
      });
    }

    const changed = finalizePlanIfReady(group);
    if (!changed) {
      return res.status(400).json({
        message:
          "Voting is still open. Finalization happens when everyone votes or the window closes.",
      });
    }

    group.nextSessionPlan.finalizedBy = userId;
    if (group.nextSessionPlan.planStatus === "finalized") {
      group.nextSessionPlan.finalizedAt = new Date();
    }

    await group.save();
    const populated = await populateGroupQuery(groupId);
    res.status(200).json(populated);
  } catch (err) {
    res
      .status(500)
      .json({ message: "Failed to finalize the planned next session" });
  }
};

export const updateGroupSessionSettings = async (req, res) => {
  try {
    const userId = req.user._id;
    const {
      groupId,
      teachingMinutes,
      discussionMinutes,
      quizMinutes,
      breakMinutes,
      minimumTeachingMinutes,
    } = req.body;
    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }
    if (!ensureCreator(group, userId)) {
      return res
        .status(403)
        .json({ message: "Only the creator can update session settings" });
    }

    group.sessionSettings = {
      teachingMinutes: Math.max(
        1,
        Number(teachingMinutes) || group.sessionSettings?.teachingMinutes || 1,
      ),
      discussionMinutes: Math.max(
        1,
        Number(discussionMinutes) ||
          group.sessionSettings?.discussionMinutes ||
          1,
      ),
      quizMinutes: Math.max(
        1,
        Number(quizMinutes) || group.sessionSettings?.quizMinutes || 1,
      ),
      breakMinutes: Math.max(
        1,
        Number(breakMinutes) || group.sessionSettings?.breakMinutes || 1,
      ),
      minimumTeachingMinutes: Math.max(
        1,
        Number(minimumTeachingMinutes) ||
          group.sessionSettings?.minimumTeachingMinutes ||
          1,
      ),
    };

    await group.save();
    const populated = await populateGroupQuery(groupId);
    res.status(200).json(populated);
  } catch (err) {
    res.status(500).json({ message: "Failed to update session settings" });
  }
};
