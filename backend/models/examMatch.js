import mongoose from "mongoose";
const matchSchema = new mongoose.Schema({
  users: [
    {
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
      stautus: {
        type: String,
        enum: ["pending", "accepted", "rejected"],
        default: "pending",
      },
    },
  ],
  topic: {
    type: String,
    required: true,
  },

  isGroupCreated: {
    type: Boolean,
    default: false,
  },
});
const Match = mongoose.model("Match", matchSchema);
export default Match;
