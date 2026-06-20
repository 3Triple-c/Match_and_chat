import mongoose from "mongoose";

const participantSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    isOnline: {
      type: Boolean,
      default: false,
    },
    speakRequested: {
      type: Boolean,
      default: false,
    },
    speakApproved: {
      type: Boolean,
      default: false,
    },
    speakMuted: {
      type: Boolean,
      default: false,
    },
    speakRevoked: {
      type: Boolean,
      default: false,
    },
    speakApprovals: {
      type: Number,
      default: 0,
    },
    joinedAt: {
      type: Date,
      default: Date.now,
    },
    lastSeenAt: {
      type: Date,
      default: Date.now,
    },
    messagesSent: {
      type: Number,
      default: 0,
    },
    speakRequestsCount: {
      type: Number,
      default: 0,
    },
    teachingTurns: {
      type: Number,
      default: 0,
    },
    quizScoreTotal: {
      type: Number,
      default: 0,
    },
    quizzesCompleted: {
      type: Number,
      default: 0,
    },
    lastQuizScore: {
      type: Number,
      default: 0,
    },
  },
  { _id: false },
);

const quizQuestionSchema = new mongoose.Schema(
  {
    prompt: { type: String, required: true },
    options: [{ type: String, required: true }],
    correctAnswer: { type: Number, required: true },
    explanation: { type: String, required: true },
  },
  { _id: false },
);

const quizSubmissionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    answers: [{ type: Number }],
    score: { type: Number, default: 0 },
    submittedAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const whiteboardSnapshotSchema = new mongoose.Schema(
  {
    content: { type: String, default: "" },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    updatedAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const whiteboardStrokePointSchema = new mongoose.Schema(
  {
    x: { type: Number, required: true },
    y: { type: Number, required: true },
  },
  { _id: false },
);

const whiteboardStrokeSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    color: { type: String, default: "#263238" },
    points: [whiteboardStrokePointSchema],
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const breakTrackSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    url: { type: String, default: "" },
    addedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    addedAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const breakActivitySchema = new mongoose.Schema(
  {
    type: {
      type: String,
      default: "info",
    },
    label: {
      type: String,
      required: true,
    },
    detail: {
      type: String,
      default: "",
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false },
);

const studySessionSchema = new mongoose.Schema(
  {
    group: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Group",
      required: true,
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    status: {
      type: String,
      enum: ["lobby", "active", "ended"],
      default: "lobby",
      index: true,
    },
    currentPhase: {
      type: String,
      enum: ["teaching", "discussion", "break", "quiz", "reveal"],
      default: "teaching",
    },
    phaseIndex: {
      type: Number,
      default: 0,
    },
    phaseStartedAt: Date,
    phaseEndsAt: Date,
    teacherUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    teacherHistory: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    nextTeacherUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    nextTeacherRevealedAt: {
      type: Date,
      default: null,
    },
    selectedBySystemAt: {
      type: Date,
      default: null,
    },
    revealAvailableTo: {
      type: String,
      enum: ["creator", "teacher", "none"],
      default: "none",
    },
    teacherPrepared: {
      type: Boolean,
      default: false,
    },
    teacherReadyAt: {
      type: Date,
      default: null,
    },
    chatFrozen: {
      type: Boolean,
      default: false,
    },
    activePrompt: {
      type: String,
      default: "",
    },
    scheduledFor: {
      type: Date,
      default: null,
    },
    planning: {
      focusTopic: { type: String, default: "" },
      prepNotes: { type: String, default: "" },
      sourceType: {
        type: String,
        enum: ["topic", "notes", "pdf", "link"],
        default: "topic",
      },
      sourceLabel: { type: String, default: "" },
      sourceLink: { type: String, default: "" },
      sourceText: { type: String, default: "" },
    },
    participants: [participantSchema],
    settings: {
      teachingMinutes: { type: Number, default: 1 },
      discussionMinutes: { type: Number, default: 1 },
      quizMinutes: { type: Number, default: 1 },
      breakMinutes: { type: Number, default: 1 },
      minimumTeachingMinutes: { type: Number, default: 1 },
    },
    quiz: {
      topic: { type: String, default: "" },
      source: { type: String, default: "fallback" },
      questions: [quizQuestionSchema],
      submissions: [quizSubmissionSchema],
      releasedAt: Date,
    },
    summaries: [
      {
        generatedAt: { type: Date, default: Date.now },
        phase: String,
        topPerformerLabel: String,
        participationNote: String,
        quizNote: String,
      },
    ],
    whiteboard: {
      content: { type: String, default: "" },
      updatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
      },
      updatedAt: { type: Date, default: null },
      strokes: [whiteboardStrokeSchema],
      snapshots: [whiteboardSnapshotSchema],
    },
    breakMedia: {
      queue: [breakTrackSchema],
      currentTrackIndex: { type: Number, default: 0 },
      isPlaying: { type: Boolean, default: false },
      playbackPositionSeconds: { type: Number, default: 0 },
      lastActionAt: { type: Date, default: null },
      syncedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
      },
      theme: {
        type: String,
        default: "lofi-focus",
      },
      activityFeed: [breakActivitySchema],
    },
    endedReason: {
      type: String,
      enum: ["completed", "manual", "interrupted"],
      default: null,
    },
  },
  { timestamps: true },
);

const StudySession = mongoose.model("StudySession", studySessionSchema);
export default StudySession;
