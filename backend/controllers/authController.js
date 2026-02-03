import User from "../models/User.js";
import jwt from "jsonwebtoken";

const generateToken = userId => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRETT, {
    expiresIn: "7d",
  });
};

// reigister new user
export const registerUser = async (req, res) => {
  try {
    const { name, email, password, department, level, studyTime, interest } =
      req.body;
    const existingUser = await User.findOne({ email });
    if (existingUser)
      return res.status(400).json({ message: "User already exists" });
    const newUser = await User.create({
      name,
      email,
      password,
      department,
      level,
      studyTime,
      interest,
    });
    const token = generateToken(newUser._id);
    res.status(201).json({
      user: {
        id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        password: newUser.password,
        department: newUser.department,
        level: newUser.level,
        studyTime: newUser.studyTime,
        interest: newUser.interest,
      },
      token,
    });
  } catch (err) {
    console.log(err);
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
        password: user.password,
        department: user.department,
        level: user.level,
        studyTime: user.studyTime,
        interest: user.interest,
      },
      token,
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "" });
  }
};
