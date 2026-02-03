import mongoose from "mongoose";

const matchRequestSchema = new mongoose.Schema({
  users: [
    {
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        require: true,
      },
      status: {
        type: String,
        enum: ["pending", "accepted", "rejected"],
        default: "pending",
      },
    },
  ],
  expiresAt: {
    type: Date,
    default: Date.now,
  },
  name: {
    type: String,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  isGroupCreated: {
    type: Boolean,
    default: false,
  },
  groupId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Group",
    default: null,
  },
  compactibiltyScores: [
    {
      users: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
      score: Number,
      sharedInterests: [],
    },
  ],
});

const Match = mongoose.model("Match", matchRequestSchema);
export default Match;
