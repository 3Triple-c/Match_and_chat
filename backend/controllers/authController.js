import User from "../models/User.js";
import jwt from "jsonwebtoken";
import { validateAndNormalizeInterests } from "../utils/interestValidation.js";
import { getJwtSecret } from "../utils/jwt.js";
import { assertValidStudyTime } from "../utils/studyTime.js";

const generateToken = userId => {
  return jwt.sign({ id: userId }, getJwtSecret(), {
    expiresIn: "7d",
  });
};

// reigister new user
export const registerUser = async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      department,
      level,
      studyTime,
      interest,
      primaryInterest,
    } = req.body;
    const normalized = await validateAndNormalizeInterests({
      interest,
      primaryInterest,
    });
    const normalizedStudyTime = assertValidStudyTime(studyTime);
    const existingUser = await User.findOne({ email });
    if (existingUser)
      return res.status(400).json({ message: "User already exists" });
    const newUser = await User.create({
      name,
      email,
      password,
      department,
      level,
      studyTime: normalizedStudyTime,
      interest: normalized.interest,
      primaryInterest: normalized.primaryInterest,
    });
    const token = generateToken(newUser._id);
    res.status(201).json({
      user: {
        id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        department: newUser.department,
        level: newUser.level,
        studyTime: newUser.studyTime,
        interest: newUser.interest,
        primaryInterest: newUser.primaryInterest,
        studyStreak: newUser.studyStreak,
        longestStudyStreak: newUser.longestStudyStreak,
      },
      token,
    });
  } catch (err) {
    console.log(err);
    if (
      err.message?.includes("primaryInterest") ||
      err.message?.includes("Invalid interests") ||
      err.message?.includes("Study time must be one of")
    ) {
      return res.status(400).json({ message: err.message });
    }
    res.status(500).json({ message: "server error", error: err.message });
  }
};

// login user
export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email }).select("+password");
    if (!user) return res.status(400).json({ message: "invalid credentials" });

    const isMatch = await user.comparePassword(password);
    if (!isMatch)
      return res.status(400).json({ message: "invalid credentials" });
    const token = generateToken(user._id);
    res.json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department,
        level: user.level,
        studyTime: user.studyTime,
        interest: user.interest,
        primaryInterest: user.primaryInterest,
        studyStreak: user.studyStreak,
        longestStudyStreak: user.longestStudyStreak,
      },
      token,
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "" });
  }
};
