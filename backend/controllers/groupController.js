import Group from "../models/Group.js";
import User from "../models/User.js";
import Match from "../models/Match.js";
export const getGroupDetails = async (req, res) => {
  try {
    const userId = req.user._id;
    const { groupId } = req.body;
    // fetch user
    const user = await User.findById(userId);
    if (!user.groups.includes(groupId)) {
      return res
        .status(403)
        .json({ message: "Access is denied to this group" });
    }
    // fetch group
    const group = await Group.findById(groupId).populate(
      "members",
      "name email studyTime interest level",
    );
    if (!group) {
      return res.status(404).json({ message: "Group not Found" });
    }
    res.status(200).json(group);
  
  } catch (err) {
    // console.error("error fetching group details", err);
    res.status(500).json({ message: "error fetching group details" });
  }
};

// Leave group
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

    //remove user from group members
    await Group.findByIdAndUpdate(groupId, {
      $pull: { members: userId },
    });

    await User.findByIdAndUpdate(userId, {
      $pull: { groups: groupId },
      lastLeftGroupAt: new Date(),
    });

    //delete group if empty
    const updatedGroup = await Group.findById(groupId);
    if (updatedGroup.members.length < 3) {
      if (!updatedGroup) {
        res.status(200).json({ message: "Group already removed" });
      }
      await User.updateMany(
        { _id: { $in: updatedGroup.members } },
        {
          $pull: { groups: groupId },
          $set: { lastLeftGroupAt: new Date() },
        },
      );
      // await Group.findByIdAndDelete(groupId);
      await Group.findByIdAndUpdate(groupId, {
        $set: { isActive: false },
      });
    }

    res.status(200).json({ message: "left group successfully" });
  } catch (err) {
    // console.error("error leaving group:", err);
    res.status(500).json({ message: "error leaving group" });
  }
};

// rate group
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
    //check feedback array
    if (group.feedbacks.some(fb => fb.user.equals(userId))) {
      return res.status(400).json({ message: "you already rated this group" });
    }
  
    group.feedbacks.push({ user: userId, rating: numericRating, comment });
    await group.save();

    res.status(200).json({ message: "feedback Submitted" });
  } catch (err) {
    // console.error("error rating group", err);
    res.status(500).json({ message: "server error submitting feedback" });
  }
};

// deleteGroup
export const deleteGroup = async (req, res) => {
  try {
    const { groupId } = req.body;
    //find and delete the group
    const group = await Group.findByIdAndDelete(groupId);
    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }
    // reseting users thta were in the group
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
    // await Match.findOneAndUpdate(
    //   { groupId: groupId },
    //   {
    //     $set: { isActive: false },
    //   }
    // );
    res.json({ message: "Grooup deleted and users updated" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "error deleting group", err });
  }
};

export const getMyGroups = async (req, res) => {
  try {
    const userId = req.user._id;
    const groups = await Group.find({
      members: userId,
    }).select("_id name members createdAt");

    res.status(200).json(groups);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch groups" });
  }
};
