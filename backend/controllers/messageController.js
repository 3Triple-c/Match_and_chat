import Message from "../models/Message.js";
import Group from "../models/Group.js";
import mongoose from "mongoose";
export const getGroupMessages = async (req, res) => {
  try {
    const { groupId } = req.params;
    const userId = req.user._id;
    if (!groupId) {
      return res.status(400).json({ message: "Group ID is required" });
    }
    if (!mongoose.Types.ObjectId.isValid(groupId)) {
      return res.status(400).json({ message: "Invalid group ID" });
    }
    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }
    if (!group.members.some(m => m.toString() === userId.toString())) {
      return res.status(403).json({ message: "Not authorized" });
    }
    const messages = await Message.find({ group: groupId })
      .sort({ createdAt: 1 })
      .populate("sender", "_id email");

    res.status(200).json(messages);
  } catch (err) {
    console.error("Fetch messages error:", err);
    res.status(500).json({ message: "Failed to fetch messages" });
  }
};
