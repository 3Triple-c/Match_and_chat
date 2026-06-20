import mongoose from "mongoose";

const nextSessionVoteSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    time: {
      type: Date,
      required: true,
    },
    votedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false },
);

const nextSessionTimeOptionSchema = new mongoose.Schema(
  {
    label: {
      type: String,
      default: "",
    },
    value: {
      type: Date,
      required: true,
    },
    voteCount: {
      type: Number,
      default: 0,
    },
  },
  { _id: false },
);

const groupSchema = new mongoose.Schema({
  internalName: {
    type: String,
    required: false,
  },
  name: {
    type: String,
    required: false,
  },
  topic: {
    type: String,
    required: true,
  },
  members: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  ],
  isActive: {
    type: Boolean,
    default: true,
  },
  studyStreak: {
    type: Number,
    default: 0,
  },
  longestStudyStreak: {
    type: Number,
    default: 0,
  },
  lastStudyActivityAt: {
    type: Date,
    default: null,
  },
  sessionSettings: {
    teachingMinutes: {
      type: Number,
      default: 1,
    },
    discussionMinutes: {
      type: Number,
      default: 1,
    },
    quizMinutes: {
      type: Number,
      default: 1,
    },
    breakMinutes: {
      type: Number,
      default: 1,
    },
    minimumTeachingMinutes: {
      type: Number,
      default: 1,
    },
  },
  nextSessionPlan: {
    topic: {
      type: String,
      default: "",
    },
    prepNotes: {
      type: String,
      default: "",
    },
    sourceType: {
      type: String,
      default: "topic",
    },
    sourceLabel: {
      type: String,
      default: "",
    },
    sourceLink: {
      type: String,
      default: "",
    },
    sourceText: {
      type: String,
      default: "",
    },
    listedTimeOptions: [nextSessionTimeOptionSchema],
    votes: [nextSessionVoteSchema],
    teacherUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    scheduledFor: {
      type: Date,
      default: null,
    },
    finalizedAt: {
      type: Date,
      default: null,
    },
    voteWindowEndsAt: {
      type: Date,
      default: null,
    },
    finalizedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    teacherRevealedAt: {
      type: Date,
      default: null,
    },
    isPinned: {
      type: Boolean,
      default: false,
    },
    planStatus: {
      type: String,
      enum: ["draft", "voting", "finalized", "needs_update"],
      default: "draft",
    },
  },
  feedbacks: [
    {
      user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      rating: { type: Number, min: 1, max: 5 },
      comment: String,
      createdsAt: { type: Date, default: Date.now },
    },
  ],
  createBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});
const Group = mongoose.model("Group", groupSchema);
export default Group;
