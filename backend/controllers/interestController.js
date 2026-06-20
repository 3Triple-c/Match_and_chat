import Interest from "../models/Interest.js";

export const getInterests = async (req, res) => {
  try {
    const interests = await Interest.find({ isActive: true })
      .sort({ name: 1 })
      .select("name -_id");
    res.status(200).json(interests.map(i => i.name));
  } catch (err) {
    console.error("Error fetching interests:", err);
    res.status(500).json({ message: "Failed to fetch interests" });
  }
};
