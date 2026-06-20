import User from "../models/User.js";
import { validateAndNormalizeInterests } from "../utils/interestValidation.js";
import { assertValidStudyTime } from "../utils/studyTime.js";
//get profile
export const getUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Server error" });
  }
};
// u;padte profile 
export const updateProfile = async (req, res) => {
  try {
    const updates = { ...req.body };
    if (
      Object.prototype.hasOwnProperty.call(updates, "interest") ||
      Object.prototype.hasOwnProperty.call(updates, "primaryInterest")
    ) {
      const current = await User.findById(req.user.id);
      if (!current) return res.status(404).json({ message: "User not found" });
      const normalized = await validateAndNormalizeInterests({
        interest:
          updates.interest !== undefined ? updates.interest : current.interest,
        primaryInterest:
          updates.primaryInterest !== undefined
            ? updates.primaryInterest
            : current.primaryInterest,
      });
      updates.interest = normalized.interest;
      updates.primaryInterest = normalized.primaryInterest;
    }
    if (Object.prototype.hasOwnProperty.call(updates, "studyTime")) {
      updates.studyTime = assertValidStudyTime(updates.studyTime);
    }

    const user = await User.findByIdAndUpdate(req.user.id, updates, {
      new: true,
    }).select("-password");
    res.json(user);
  } catch (err) {
    console.log(err);
    if (
      err.message?.includes("primaryInterest") ||
      err.message?.includes("Invalid interests") ||
      err.message?.includes("Study time must be one of")
    ) {
      return res.status(400).json({ message: err.message });
    }
    res.status(500).json({ message: "server error" });
  }
};
// toggle availablity
export const toggleAvailability = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "User not found" });
    user.isAvailable = !user.isAvailable;
    await user.save();
    res.json({
      message: `Availability set to ${user.isAvailable ? "ON" : "OFF"}`,
      isAvailable: user.isAvailable,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error toggling availability" });
  }
};
