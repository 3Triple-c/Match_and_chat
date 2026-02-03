import User from "../models/User.js";
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
    const updates = req.body;
    const user = await User.findByIdAndUpdate(req.user.id, updates, {
      new: true,
    }).select("-password");
    res.json(user);
  } catch (err) {
    console.log(err);
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
