import User from "../models/User.js";
import Match from "../models/Match.js";
import Group from "../models/Group.js";
import { sendMatchEmail } from "../utils/mailer.js";
export const createMatch = async (req, res) => {
  const COOLDOWN_HOURS = 2;
  try {
    // match cooldown
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: "user not found" });
    }
    if (user.lastLeftGroupAt) {
      const cooldownEnds = new Date(
        user.lastLeftGroupAt.getTime() + COOLDOWN_HOURS * 60 * 60 * 1000,
      );
      const now = new Date();
      if (now < cooldownEnds) {
        const remaininMintues = Math.ceil((cooldownEnds - now) / 60000);
        return res.status(403).json({
          message: `you must wait for ${remaininMintues} more minutes before matchin again... `,
        });
      }
    }

    const { faculty, department, level, studyTime, location, topic } = req.body;

    if (!topic) {
      return res.status(400).json({ message: "Study topic is required" });
    }

    const similarUsers = await User.find({
      _id: { $ne: user._id },
      faculty,
      department,
      level,
      studyTime,
      location,
    }).limit(5); // 5 users + current =6max
    if (similarUsers.length < 2) {
      return req
        .status(400)
        .json({ message: "Not enough users to create a match." });
    }

    const matchUsers = [
      {
        user: user._id,
        status: "accepted",
      },
      ...similarUsers.map(u => ({ user: u._id, status: "pending" })),
    ];

    const newMatch = await Match.create({
      users: matchUsers,
      topic,
    });
    res
      .status(201)
      .json({ message: "Match created successfully", match: newMatch });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Error creating match" });
  }
};
//  accept match
export const acceptMatch = async (req, res) => {
  try {
    const { matchId, userId } = req.body;
    const match = await Match.findById(matchId);

    if (!match || match.isGroupCreated) {
      return res
        .status(404)
        .json({ message: "Invalid match or group already created" });
    }
    // changing/updating user status
    let userFound = false;
    match.users = match.users.map(entry => {
      if (entry.user.toString() === userId) {
        userFound = true;
        return { ...entry.toObject(), status: "accepted" };
      }
      return entry;
    });
    if (!userFound) {
      return res.status(404).json({ message: "User not part of this match" });
    }
    //   count how many accepted
    const acceptedUsers = match.users.filter(u => u.stautus === "accepted");
    // autocreate group
    if (acceptedUsers.length >= 3 && !match.isGroupCreated) {
      const memberIds = acceptedUsers.map(u => u.user);
      const group = await Group.create({
        name: `Study Group on ${match.topic}`,
        topic: match.topic,
        members: memberIds,
        createdBy: memberIds[0],
      });
      match.isGroupCreated = true;
      await match.save();
      return res.status(200).json({ message: "Group Created ", group });
    }
    // await sendMatchEmail(
    //   member.email, // loop through members
    //   "You’ve been added to a study group!",
    //   `<p>Your study group for <strong>${match.topic}</strong> is ready.</p>`
    // );
    await match.save();
    return res.status.json({
      message: "Match accepted... waiting for others",
      match,
    });
  } catch (err) {
    console.error(error);
    res.status(500).json({ message: "Error accepting match" });
  }
};
export const rejectMatch = async (req, res) => {
  try {
    const { matchId, userId } = req.body;
    const match = await Match.findById(matchId);
    if (!match || match.isGroupCreated) {
      res
        .status(404)
        .json({ message: "match not found or group already created" });
    }
    const initialLength = match.users.length;
    match.users = match.users.filter(u => u.user.toString() !== userId);
    if (match.users.length === initialLength) {
      return res.status(404).json({ message: "User not in the match" });
    }
    await match.save();
    res.status(200).json({ message: "you rejected the match" });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "error rejecting match" });
  }
};

export const getUserMatch = async (req, res) => {
  try {
    const { userId } = req.params;
    const matches = await Match.find({ "users.user": userId })
      .populate("users.user", "name email")
      .populate("topic");
    res.status(200).json(matches);
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "error fecthing user matches" });
  }
};
