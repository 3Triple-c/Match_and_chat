import dotenv from "dotenv";
import mongoose from "mongoose";
import User from "../models/User.js";

dotenv.config();

const email = process.argv[2]?.trim().toLowerCase();

if (!email) {
  console.error("Usage: node scripts/makeAdmin.js <user-email>");
  process.exit(1);
}

const mongoUrl = process.env.MONGODB_URL;

if (!mongoUrl) {
  console.error("MONGODB_URL is not configured.");
  process.exit(1);
}

try {
  await mongoose.connect(mongoUrl);

  const user = await User.findOneAndUpdate(
    { email },
    { $set: { role: "admin" } },
    { new: true },
  ).select("name email role");

  if (!user) {
    console.error(`No user found for ${email}`);
    process.exit(1);
  }

  console.log(`Admin granted to ${user.email}`);
} catch (err) {
  console.error("Failed to grant admin role:", err.message);
  process.exit(1);
} finally {
  await mongoose.disconnect();
}
