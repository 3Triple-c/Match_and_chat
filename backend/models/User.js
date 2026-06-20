import mongoose from "mongoose";
import bcrypt from "bcrypt";
import { STUDY_TIME_VALUES } from "../utils/studyTime.js";
const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      unique: true,
      required: true,
      lowercase: true,
    },
    password: {
      type: String,
      required: true,
      // midlength: 6,
      select: false,
    },
    department: {
      type: String,
      required: true,
    },
    faculty: {
      type: String,
      required: false,
    },
    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user",
    },
    level: {
      type: String,
      required: true,
    },
    interest: {
      type: [String], //['maths']
      default: [],
    },
    primaryInterest: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    studyTime: {
      type: String,
      required: true,
      enum: STUDY_TIME_VALUES,
    },
    location: {
      type: String,
      required: false,
    },
    groups: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Group",
      },
    ],
    lastLeftGroupAt: {
      type: Date,
      default: null,
    },
    isAvailable: {
      type: Boolean,
      default: true,
      //remember to set false
    },
    studyStreak: {
      type: Number,
      default: 0,
    },
    longestStudyStreak: {
      type: Number,
      default: 0,
    },
    lastSessionCompletedAt: {
      type: Date,
      default: null,
    },
    lastMeaningfulVisitAt: {
      type: Date,
      default: null,
    },
    lastMeaningfulChatAt: {
      type: Date,
      default: null,
    },
    isOnlineOnApp: {
      type: Boolean,
      default: false,
    },
    lastSeenOnAppAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);
// hash password
userSchema.pre("save", async function () {
  if (!this.isModified("password")) return;
  this.password = await bcrypt.hash(this.password, 12);
});
// compare inputted passwordwith  stored one

userSchema.methods.comparePassword = function (userPassword) {
  return bcrypt.compare(userPassword, this.password);
};

const User = mongoose.model("User", userSchema);
export default User;
