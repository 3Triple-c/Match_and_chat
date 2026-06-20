import mongoose from "mongoose";
import Group from "../models/Group.js";
import StudySession from "../models/StudySession.js";
import User from "../models/User.js";
import { getIO } from "../middleware/socket.js";
import { normalizeStudyTime } from "../utils/studyTime.js";
import { generateQuizWithOpenAI } from "../utils/openaiQuiz.js";
import { importStudyMaterial } from "../utils/materialImport.js";

const PHASES = ["teaching", "discussion", "break", "quiz", "reveal"];
const sessionTimers = new Map();
const sessionWarnings = new Map();
const ENDED_SESSION_REVEAL_WINDOW_MS = 30 * 1000;
const BREAK_THEME_LIBRARY = {
  "lofi-focus": {
    label: "Lo-fi Focus",
    description: "Soft, steady, and calm for a reset that still feels active.",
    accent: "#a5c2b1",
    glow: "#cde0d6",
  },
  "ambient-calm": {
    label: "Ambient Calm",
    description: "Loose ambience with a clean, reflective room feeling.",
    accent: "#7aa08a",
    glow: "#dbe9df",
  },
  "afrobeat-chill": {
    label: "Afrobeat Chill",
    description: "Warm, rhythmic energy that keeps the room social.",
    accent: "#e0c0a5",
    glow: "#f1ddcb",
  },
  "jazz-room": {
    label: "Jazz Room",
    description: "Smooth, warm, and polished for a relaxed group wind-down.",
    accent: "#c78a8c",
    glow: "#efd0d1",
  },
  "rain-room": {
    label: "Rain Room",
    description: "Quiet rainfall atmosphere for a softer mental reset.",
    accent: "#607d8b",
    glow: "#d8e2e7",
  },
};
const DEFAULT_BREAK_THEME = "lofi-focus";
const BREAK_ACTIVITY_LIMIT = 10;

const QUIZ_BANK = {
  math: [
    {
      prompt: "Which idea is most central to solving many algebra problems?",
      options: [
        "Keep both sides of an equation balanced",
        "Memorize random numbers",
        "Ignore variables",
        "Estimate without checking",
      ],
      correctAnswer: 0,
      explanation:
        "Balancing both sides is the core logic behind algebraic manipulation.",
    },
    {
      prompt: "What does a graph often help you do in mathematics?",
      options: [
        "Hide patterns",
        "Visualize relationships between quantities",
        "Avoid reasoning",
        "Replace all calculations",
      ],
      correctAnswer: 1,
      explanation:
        "Graphs help you see relationships, trends, and changes more clearly.",
    },
    {
      prompt: "Why do students check each step in a math solution?",
      options: [
        "To make the work longer",
        "To confirm logic and reduce mistakes",
        "To avoid understanding",
        "To skip the answer",
      ],
      correctAnswer: 1,
      explanation:
        "Step-by-step checking helps catch logical or arithmetic errors early.",
    },
  ],
  physics: [
    {
      prompt: "Physics problems usually improve when you first identify:",
      options: [
        "The important quantities and their relationships",
        "Only the final answer",
        "The textbook cover",
        "A random formula",
      ],
      correctAnswer: 0,
      explanation:
        "Understanding the quantities and how they relate is the foundation of solving physics problems.",
    },
    {
      prompt: "Why are units important in physics?",
      options: [
        "They are optional decoration",
        "They help verify whether an answer is meaningful",
        "They replace equations",
        "They are only for exams",
      ],
      correctAnswer: 1,
      explanation:
        "Units help confirm the reasoning and consistency of an answer.",
    },
    {
      prompt: "A diagram in physics is most useful because it helps you:",
      options: [
        "Avoid understanding the situation",
        "Visualize forces, motion, or structure",
        "Memorize without thinking",
        "Remove all calculations",
      ],
      correctAnswer: 1,
      explanation:
        "Diagrams help translate real situations into solvable models.",
    },
  ],
  chemistry: [
    {
      prompt: "Why do chemists balance equations?",
      options: [
        "To make them look symmetrical",
        "To reflect conservation of matter",
        "To avoid calculations",
        "To change the substances involved",
      ],
      correctAnswer: 1,
      explanation:
        "Balanced equations reflect that atoms are conserved in reactions.",
    },
    {
      prompt: "What is a good first step when studying a chemistry process?",
      options: [
        "Identify the substances and how they change",
        "Ignore state changes",
        "Memorize symbols without meaning",
        "Skip to the hardest formula",
      ],
      correctAnswer: 0,
      explanation:
        "Understanding the substances and transformations gives the process structure.",
    },
    {
      prompt: "Why are trends useful in chemistry?",
      options: [
        "They reveal patterns in behavior and reactivity",
        "They replace all experiments",
        "They only matter in history",
        "They make equations unnecessary",
      ],
      correctAnswer: 0,
      explanation:
        "Chemical trends help students reason about unfamiliar cases.",
    },
  ],
  biology: [
    {
      prompt: "Biology becomes easier to understand when you focus on:",
      options: [
        "How structures connect to functions",
        "Only memorizing names",
        "Ignoring systems",
        "Skipping processes",
      ],
      correctAnswer: 0,
      explanation: "Structure and function are tightly linked in biology.",
    },
    {
      prompt: "Why is classification useful in biology?",
      options: [
        "It hides relationships",
        "It helps organize and compare living things",
        "It replaces observation",
        "It removes variation",
      ],
      correctAnswer: 1,
      explanation:
        "Classification provides a framework for comparing organisms.",
    },
    {
      prompt: "A biological process is easier to remember when you:",
      options: [
        "Break it into stages",
        "Ignore sequence",
        "Memorize only one keyword",
        "Avoid diagrams",
      ],
      correctAnswer: 0,
      explanation:
        "Breaking a process into stages makes it easier to understand and recall.",
    },
  ],
  "computer science": [
    {
      prompt: "Why do programmers break problems into smaller parts?",
      options: [
        "To make debugging and reasoning easier",
        "To avoid thinking",
        "To make the code slower",
        "To remove logic",
      ],
      correctAnswer: 0,
      explanation:
        "Problem decomposition improves clarity, testing, and maintenance.",
    },
    {
      prompt: "What makes an algorithm useful?",
      options: [
        "It solves a problem with clear steps",
        "It always avoids structure",
        "It hides the input",
        "It only works once",
      ],
      correctAnswer: 0,
      explanation:
        "An algorithm is valuable because it gives a clear procedure for solving a problem.",
    },
    {
      prompt: "Why is testing important in software work?",
      options: [
        "It helps catch errors and verify expected behavior",
        "It replaces design",
        "It makes code shorter automatically",
        "It is only useful after deployment",
      ],
      correctAnswer: 0,
      explanation:
        "Testing helps confirm that code behaves correctly under expected conditions.",
    },
  ],
  coding: [
    {
      prompt: "Clean code usually improves a team because it is:",
      options: [
        "Easier to read and maintain",
        "Harder to debug",
        "More random",
        "Always shorter",
      ],
      correctAnswer: 0,
      explanation:
        "Readable code improves collaboration, debugging, and long-term maintenance.",
    },
    {
      prompt: "Why do developers use functions?",
      options: [
        "To organize reusable logic",
        "To remove structure",
        "To avoid naming things",
        "To hide all bugs",
      ],
      correctAnswer: 0,
      explanation:
        "Functions package reusable logic into understandable units.",
    },
    {
      prompt: "What is a strong debugging habit?",
      options: [
        "Change many things at once",
        "Test one assumption at a time",
        "Guess without checking",
        "Ignore the error message",
      ],
      correctAnswer: 1,
      explanation:
        "Testing one assumption at a time makes debugging more systematic.",
    },
  ],
  python: [
    {
      prompt: "Why is readability often associated with Python?",
      options: [
        "Its syntax encourages clear structure",
        "It removes the need for logic",
        "It never needs debugging",
        "It hides variables automatically",
      ],
      correctAnswer: 0,
      explanation:
        "Python emphasizes readable structure, which supports understanding.",
    },
    {
      prompt: "When would a list be useful in Python?",
      options: [
        "When storing an ordered collection of items",
        "When avoiding data structures",
        "When hiding all values",
        "When replacing every loop",
      ],
      correctAnswer: 0,
      explanation: "Lists are commonly used for ordered collections of values.",
    },
    {
      prompt: "A useful habit in Python programming is to:",
      options: [
        "Use descriptive names for variables and functions",
        "Avoid naming things clearly",
        "Write everything in one line",
        "Ignore indentation",
      ],
      correctAnswer: 0,
      explanation:
        "Descriptive naming makes code easier to understand and maintain.",
    },
  ],
};

const GENERIC_QUIZ = topic => [
  {
    prompt: `In a ${topic} study session, what best supports deeper understanding?`,
    options: [
      "Explaining ideas clearly and checking understanding",
      "Rushing without reflection",
      "Avoiding questions",
      "Memorizing without context",
    ],
    correctAnswer: 0,
    explanation:
      "Clear explanation and understanding checks strengthen learning in any topic.",
  },
  {
    prompt: `Why is discussion useful after teaching in ${topic}?`,
    options: [
      "It helps surface confusion and improve clarity",
      "It removes the need to think",
      "It always ends the session",
      "It replaces practice completely",
    ],
    correctAnswer: 0,
    explanation:
      "Discussion helps reveal misunderstandings and deepen the topic.",
  },
  {
    prompt: `What is the best reason to include a quiz in a ${topic} study cycle?`,
    options: [
      "To check understanding and reinforce learning",
      "To waste time",
      "To avoid participation",
      "To replace teaching entirely",
    ],
    correctAnswer: 0,
    explanation: "A quiz gives fast feedback and reinforces what was learned.",
  },
];

const isMember = (group, userId) =>
  group.members.some(member => member.toString() === userId.toString());

const sessionRoomId = groupId => `session:${groupId}`;

const durationForPhase = (settings, phase) => {
  const map = {
    teaching: settings.teachingMinutes,
    discussion: settings.discussionMinutes,
    quiz: settings.quizMinutes,
    break: settings.breakMinutes,
    reveal: 1,
  };

  return (map[phase] || 5) * 60 * 1000;
};

const isParticipantAvailableForTeaching = participant =>
  !!participant && participant.isOnline;

const normalizeSessionSettings = settings => ({
  teachingMinutes: Math.max(1, Number(settings?.teachingMinutes) || 1),
  discussionMinutes: Math.max(1, Number(settings?.discussionMinutes) || 1),
  quizMinutes: Math.max(1, Number(settings?.quizMinutes) || 1),
  breakMinutes: Math.max(1, Number(settings?.breakMinutes) || 1),
  minimumTeachingMinutes: Math.max(
    1,
    Number(settings?.minimumTeachingMinutes) || 1,
  ),
});

const pickNextTeacher = (memberIds, history = []) => {
  const recentOrder = history.map(id => id.toString());
  const scored = memberIds.map(memberId => {
    const id = memberId.toString();
    const index = recentOrder.lastIndexOf(id);
    return {
      id: memberId,
      score: index === -1 ? -1 : index,
    };
  });

  scored.sort((a, b) => a.score - b.score);
  const lowestScore = scored[0]?.score ?? -1;
  const eligible = scored
    .filter(item => item.score === lowestScore)
    .map(item => item.id);

  return eligible[Math.floor(Math.random() * eligible.length)] || memberIds[0];
};

const getRecentTeacherSelectionHistory = async (session, limit = 6) => {
  const recentSessions = await StudySession.find({
    group: session.group,
    teacherUser: { $ne: null },
    _id: { $ne: session._id },
  })
    .sort({ updatedAt: -1 })
    .limit(limit)
    .select("teacherUser");

  const combinedHistory = [
    ...(session.teacherHistory || []).map(id => id.toString()),
    ...recentSessions
      .map(recentSession => recentSession.teacherUser?.toString())
      .filter(Boolean),
  ];

  return [...new Set(combinedHistory)];
};

const resolveTopic = ({ group, participants }) => {
  const topicCandidates = [
    group?.topic,
    group?.name,
    ...participants.map(participant => participant.user?.primaryInterest),
  ]
    .filter(Boolean)
    .map(value => value.toString().trim().toLowerCase());

  return topicCandidates[0] || "general study";
};

const buildQuiz = topic => {
  const normalizedTopic = topic.toLowerCase();
  const bank = QUIZ_BANK[normalizedTopic] || GENERIC_QUIZ(topic);
  return bank.slice(0, 3);
};

const normalizeSnippet = value =>
  value
    .replace(/\s+/g, " ")
    .replace(/^[\-\*\d\.\)\s]+/, "")
    .trim();

const splitMaterialIntoFacts = material => {
  if (!material) return [];

  return material
    .split(/\n|[.!?]+/g)
    .map(normalizeSnippet)
    .filter(Boolean)
    .filter(line => line.length >= 18)
    .filter(
      (line, index, arr) =>
        arr.findIndex(item => item.toLowerCase() === line.toLowerCase()) ===
        index,
    )
    .slice(0, 10);
};

const buildMaterialQuiz = ({ topic, materialText }) => {
  const facts = splitMaterialIntoFacts(materialText);
  if (facts.length < 2) {
    return null;
  }

  const genericDistractors = [
    "It was introduced as a break activity rather than the main lesson",
    "It was explicitly rejected during the teaching phase",
    "It only appeared as an unrelated example",
    "It was not supported by the session material",
  ];

  const buildQuestionFromFact = (fact, index) => {
    const siblingFacts = facts.filter(
      (_, siblingIndex) => siblingIndex !== index,
    );
    const trimmedFact = fact.replace(/\s+/g, " ").trim();
    const keywords = trimmedFact
      .toLowerCase()
      .split(/[^a-z0-9]+/g)
      .filter(Boolean)
      .filter(word => word.length > 4)
      .slice(0, 3);

    const promptVariants = [
      `Which statement was actually emphasized in this ${topic} session?`,
      `According to the shared ${topic} material, which point is correct?`,
      `Which idea best matches what the group covered about ${topic}?`,
    ];

    const relatedDistractors = siblingFacts
      .filter(
        candidate =>
          !keywords.some(keyword => candidate.toLowerCase().includes(keyword)),
      )
      .slice(0, 2);

    const distractors = [
      ...relatedDistractors,
      ...genericDistractors.filter(
        distractor =>
          !keywords.some(keyword => distractor.toLowerCase().includes(keyword)),
      ),
    ].slice(0, 3);

    const options = [trimmedFact, ...distractors].slice(0, 4);

    return {
      prompt: promptVariants[index % promptVariants.length],
      options,
      correctAnswer: 0,
      explanation: `This matches the shared session material: "${trimmedFact}"`,
    };
  };

  return facts.slice(0, 3).map(buildQuestionFromFact);
};

const resolveSessionMaterial = session => {
  const parts = [
    session.planning?.focusTopic,
    session.planning?.prepNotes,
    session.planning?.sourceText,
    session.whiteboard?.content,
    ...(session.whiteboard?.snapshots?.map(snapshot => snapshot.content) || []),
    session.activePrompt,
  ].filter(Boolean);

  return parts.join("\n");
};

const resolveMaterialSourceLabel = session =>
  session.planning?.sourceLabel ||
  session.planning?.sourceType ||
  session.group?.name ||
  session.group?.topic ||
  "session material";

const getOnlineUserIdsForGroup = groupId => {
  const io = getIO();
  if (!io) return [];

  const room = io.sockets.adapter.rooms.get(groupId.toString());
  if (!room) return [];

  return [...room]
    .map(socketId => io.sockets.sockets.get(socketId)?.user?._id?.toString())
    .filter(Boolean);
};

const isMeaningfulMessage = content => content.trim().length >= 12;

const inferGroupStudyTime = async group => {
  const members = await Group.findById(group._id)
    .populate("members", "studyTime")
    .select("members");

  const counts = new Map();
  for (const member of members?.members || []) {
    const key = normalizeStudyTime(member.studyTime);
    if (!key) continue;
    counts.set(key, (counts.get(key) || 0) + 1);
  }

  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "evening";
};

const buildParticipantSeed = (group, onlineUserIds = []) =>
  group.members.map(memberId => ({
    user: memberId,
    isOnline: onlineUserIds.includes(memberId.toString()),
  }));

const dayKey = date => {
  const value = new Date(date);
  return new Date(
    value.getFullYear(),
    value.getMonth(),
    value.getDate(),
  ).getTime();
};

const dayDiff = (a, b) =>
  Math.round((dayKey(a) - dayKey(b)) / (24 * 60 * 60 * 1000));

const applyDailyStreakCredit = (
  entity,
  lastField,
  streakField,
  longestField,
  date,
) => {
  if (!entity[lastField]) {
    entity[streakField] = 1;
  } else {
    const diff = dayDiff(date, entity[lastField]);
    if (diff === 0) {
      entity[streakField] = Math.max(1, entity[streakField] || 1);
    } else if (diff === 1) {
      entity[streakField] = (entity[streakField] || 0) + 1;
    } else {
      entity[streakField] = 1;
    }
  }

  entity[longestField] = Math.max(
    entity[longestField] || 0,
    entity[streakField] || 0,
  );
  entity[lastField] = date;
};

const getEligibleParticipantIdsForStreak = session =>
  session.participants
    .filter(
      participant =>
        participant.isOnline ||
        participant.messagesSent > 0 ||
        participant.speakRequestsCount > 0 ||
        participant.teachingTurns > 0 ||
        participant.quizzesCompleted > 0 ||
        participant.speakApproved,
    )
    .map(participant => participant.user.toString());

const awardMeaningfulEngagement = async userId => {
  const user = await User.findById(userId);
  if (!user) return;

  const now = new Date();
  const lastVisit = user.lastMeaningfulVisitAt || user.lastSessionCompletedAt;
  if (lastVisit && dayDiff(now, lastVisit) === 0) {
    user.lastMeaningfulVisitAt = now;
    await user.save();
    return;
  }

  applyDailyStreakCredit(
    user,
    "lastSessionCompletedAt",
    "studyStreak",
    "longestStudyStreak",
    now,
  );
  user.lastMeaningfulVisitAt = now;
  await user.save();
};

const updateStudyStreaksForCompletedSession = async session => {
  const eligibleUserIds = [
    ...new Set(getEligibleParticipantIdsForStreak(session)),
  ];
  const completionDate = new Date();

  if (eligibleUserIds.length) {
    const users = await User.find({ _id: { $in: eligibleUserIds } });

    for (const user of users) {
      applyDailyStreakCredit(
        user,
        "lastSessionCompletedAt",
        "studyStreak",
        "longestStudyStreak",
        completionDate,
      );
      await user.save();
    }
  }

  if (eligibleUserIds.length >= 2) {
    const group = await Group.findById(session.group);
    if (group) {
      applyDailyStreakCredit(
        group,
        "lastStudyActivityAt",
        "studyStreak",
        "longestStudyStreak",
        completionDate,
      );
      await group.save();
    }
  }
};

const canEditWhiteboard = ({ session, participant, userId }) => {
  const isTeacher = session.teacherUser?.toString() === userId.toString();
  if (session.currentPhase === "quiz") {
    return false;
  }
  if (isTeacher) {
    return true;
  }
  if (participant?.speakRevoked) {
    return false;
  }
  if (session.currentPhase === "discussion") {
    return true;
  }
  if (session.currentPhase === "teaching") {
    return !!participant?.speakApproved && !participant?.speakMuted;
  }
  return false;
};

export const canUserEditWhiteboardNow = async ({ groupId, userId }) => {
  const session = await StudySession.findOne({
    group: groupId,
    status: "active",
  }).select("status currentPhase teacherUser participants");

  if (!session) {
    return { allowed: false, reason: "No active session found" };
  }

  const participant = session.participants.find(
    item => item.user.toString() === userId.toString(),
  );

  const allowed = canEditWhiteboard({ session, participant, userId });
  return {
    allowed,
    reason: allowed
      ? null
      : "You cannot edit the whiteboard in the current mode",
  };
};

const canUseSessionAudioForState = ({
  session,
  participant,
  group,
  userId,
}) => {
  if (!session || !["lobby", "active"].includes(session.status)) {
    return false;
  }

  const normalizedUserId = userId.toString();
  const isTeacher = session.teacherUser?.toString() === normalizedUserId;
  const isCreator = group?.createBy?.toString() === normalizedUserId;

  if (isTeacher || isCreator) {
    return true;
  }

  if (session.status === "lobby") {
    return !!participant;
  }

  if (session.currentPhase === "teaching") {
    return (
      !!participant?.speakApproved &&
      !participant?.speakMuted &&
      !participant?.speakRevoked
    );
  }

  if (
    session.currentPhase === "discussion" ||
    session.currentPhase === "break"
  ) {
    return true;
  }

  return false;
};

const serializeWhiteboardForClient = session => ({
  content: session.whiteboard?.content || "",
  updatedAt: session.whiteboard?.updatedAt || null,
  updatedBy: session.whiteboard?.updatedBy || null,
  strokes: session.whiteboard?.strokes || [],
  snapshots: session.whiteboard?.snapshots || [],
});

const persistNextTeacherToGroupPlan = ({ group, session, finalizedBy }) => {
  if (!group) return;
  const existingPlan =
    group.nextSessionPlan?.toObject?.() || group.nextSessionPlan || {};
  const {
    sourceType: _sourceType,
    sourceLabel: _sourceLabel,
    sourceLink: _sourceLink,
    sourceText: _sourceText,
    ...persistedPlan
  } = existingPlan;
  group.nextSessionPlan = {
    ...persistedPlan,
    teacherUser: session.nextTeacherUser || existingPlan.teacherUser || null,
    teacherRevealedAt:
      session.nextTeacherRevealedAt || existingPlan.teacherRevealedAt || null,
    finalizedBy: finalizedBy || existingPlan.finalizedBy || null,
    isPinned: true,
  };
};

const findSessionForClient = async groupId => {
  let session = await StudySession.findOne({
    group: groupId,
    status: { $in: ["lobby", "active"] },
  })
    .sort({ createdAt: -1 })
    .populate([
      {
        path: "createdBy",
        select: "name email",
      },
      {
        path: "teacherUser",
        select: "name email",
      },
      {
        path: "nextTeacherUser",
        select: "name email primaryInterest",
      },
      {
        path: "participants.user",
        select: "name email primaryInterest",
      },
      {
        path: "quiz.submissions.user",
        select: "name email",
      },
      {
        path: "whiteboard.updatedBy",
        select: "name email",
      },
      {
        path: "whiteboard.snapshots.updatedBy",
        select: "name email",
      },
      {
        path: "breakMedia.queue.addedBy",
        select: "name email",
      },
      {
        path: "breakMedia.syncedBy",
        select: "name email",
      },
    ]);

  if (!session) {
    session = await StudySession.findOne({
      group: groupId,
      status: "ended",
      updatedAt: {
        $gte: new Date(Date.now() - ENDED_SESSION_REVEAL_WINDOW_MS),
      },
    })
      .sort({ updatedAt: -1 })
      .populate([
        {
          path: "createdBy",
          select: "name email",
        },
        {
          path: "teacherUser",
          select: "name email",
        },
        {
          path: "nextTeacherUser",
          select: "name email primaryInterest",
        },
        {
          path: "participants.user",
          select: "name email primaryInterest",
        },
        {
          path: "quiz.submissions.user",
          select: "name email",
        },
      ]);
  }

  return session;
};

const buildLeaderboard = session =>
  (session.quiz?.submissions || [])
    .map(submission => ({
      user: submission.user,
      quizScoreTotal: submission.score || 0,
      submittedAt: submission.submittedAt,
    }))
    .sort((a, b) => {
      if (b.quizScoreTotal !== a.quizScoreTotal) {
        return b.quizScoreTotal - a.quizScoreTotal;
      }
      return (
        new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime()
      );
    })
    .map((entry, index) => ({
      ...entry,
      rank: index + 1,
    }));

const buildSessionSummary = session => {
  const leaderboard = buildLeaderboard(session);
  const topPerformer = leaderboard[0];
  const totalMessages = session.participants.reduce(
    (sum, participant) => sum + (participant.messagesSent || 0),
    0,
  );
  const totalSpeakRequests = session.participants.reduce(
    (sum, participant) => sum + (participant.speakRequestsCount || 0),
    0,
  );
  const quizSubmissions = session.quiz?.submissions?.length || 0;
  const bestQuizScore = Math.max(
    0,
    ...(session.quiz?.submissions?.map(submission => submission.score) || [0]),
  );

  return {
    generatedAt: new Date(),
    phase: session.currentPhase,
    topPerformerLabel:
      topPerformer?.user?.name || topPerformer?.user?.email || "No leader yet",
    participationNote: `${totalMessages} messages shared, ${totalSpeakRequests} speak requests raised.`,
    quizNote:
      quizSubmissions > 0
        ? `${quizSubmissions} quiz submissions received. Best score: ${bestQuizScore}.`
        : "No quiz submissions recorded for the latest session quiz.",
  };
};

const serializeHistoryItem = session => ({
  _id: session._id,
  group: session.group,
  createdAt: session.createdAt,
  endedAt: session.updatedAt,
  teacherUser: session.teacherUser,
  createdBy: session.createdBy,
  summaries: session.summaries || [],
  topSummary: session.summaries?.[session.summaries.length - 1] || null,
  participantCount: session.participants?.length || 0,
});

const serializePlanning = planning => ({
  focusTopic: planning?.focusTopic || "",
  prepNotes: planning?.prepNotes || "",
  sourceType: planning?.sourceType || "topic",
  sourceLabel: planning?.sourceLabel || "",
  sourceLink: planning?.sourceLink || "",
  sourceText: planning?.sourceText || "",
});

const serializeBreakTheme = themeKey => {
  const fallback = BREAK_THEME_LIBRARY[DEFAULT_BREAK_THEME];
  const theme = BREAK_THEME_LIBRARY[themeKey] || fallback;
  return {
    key: themeKey || DEFAULT_BREAK_THEME,
    label: theme.label,
    description: theme.description,
    accent: theme.accent,
    glow: theme.glow,
  };
};

const appendBreakActivity = (
  session,
  { type = "info", label, detail = "", createdBy = null } = {},
) => {
  if (!session?.breakMedia || !label) return;
  if (!Array.isArray(session.breakMedia.activityFeed)) {
    session.breakMedia.activityFeed = [];
  }
  session.breakMedia.activityFeed.push({
    type,
    label,
    detail,
    createdBy,
    createdAt: new Date(),
  });
  session.breakMedia.activityFeed = session.breakMedia.activityFeed.slice(
    -BREAK_ACTIVITY_LIMIT,
  );
};

export const recordBreakActivity = async ({
  groupId,
  type = "info",
  label,
  detail = "",
  createdBy = null,
  onlyDuringBreak = true,
}) => {
  if (!label) return null;
  const session = await StudySession.findOne({
    group: groupId,
    status: { $in: ["lobby", "active"] },
  });
  if (!session?.breakMedia) return null;
  if (onlyDuringBreak && session.currentPhase !== "break") return null;
  appendBreakActivity(session, {
    type,
    label,
    detail,
    createdBy,
  });
  await session.save();
  return session;
};

const clearEndedSessionContent = session => {
  session.quiz.topic = "";
  session.quiz.source = "fallback";
  session.quiz.questions = [];
  session.quiz.submissions = [];
  session.quiz.releasedAt = null;
  session.planning.focusTopic = "";
  session.planning.prepNotes = "";
  session.planning.sourceType = "topic";
  session.planning.sourceLabel = "";
  session.planning.sourceLink = "";
  session.planning.sourceText = "";
  session.activePrompt = "";
  session.whiteboard.content = "";
  session.whiteboard.updatedBy = null;
  session.whiteboard.updatedAt = null;
  session.whiteboard.strokes = [];
  session.whiteboard.snapshots = [];
  if (session.breakMedia) {
    session.breakMedia.queue = [];
    session.breakMedia.currentTrackIndex = 0;
    session.breakMedia.isPlaying = false;
    session.breakMedia.playbackPositionSeconds = 0;
    session.breakMedia.lastActionAt = null;
    session.breakMedia.syncedBy = null;
    session.breakMedia.theme = DEFAULT_BREAK_THEME;
    session.breakMedia.activityFeed = [];
  }
};

const serializeSessionForClient = session => {
  if (!session) return null;

  const raw = session.toObject ? session.toObject() : session;
  const shouldRevealNextTeacher =
    raw.status === "ended" ||
    raw.status === "lobby" ||
    !!raw.nextTeacherRevealedAt;
  const isEnded = raw.status === "ended";
  return {
    ...raw,
    quiz: {
      topic: isEnded ? "" : raw.quiz?.topic || "",
      source: isEnded ? "fallback" : raw.quiz?.source || "fallback",
      releasedAt: isEnded ? null : raw.quiz?.releasedAt || null,
      questions: isEnded
        ? []
        : raw.quiz?.questions?.map((question, index) => ({
            id: index,
            prompt: question.prompt,
            options: question.options,
            explanation: question.explanation,
          })) || [],
      submissions: isEnded
        ? []
        : raw.quiz?.submissions?.map(submission => ({
            user: submission.user,
            score: submission.score,
            submittedAt: submission.submittedAt,
          })) || [],
      leaderboard: isEnded ? [] : buildLeaderboard(raw),
    },
    controls: {
      chatFrozen: raw.chatFrozen || false,
      activePrompt: raw.activePrompt || "",
    },
    planning: isEnded
      ? {
          focusTopic: "",
          prepNotes: "",
          sourceType: "topic",
          sourceLabel: "",
          sourceLink: "",
          sourceText: "",
        }
      : serializePlanning(raw.planning),
    scheduledFor: raw.scheduledFor || null,
    teacherPrepared: raw.teacherPrepared || false,
    teacherReadyAt: raw.teacherReadyAt || null,
    revealAvailableTo: raw.revealAvailableTo || "none",
    nextTeacherUser: shouldRevealNextTeacher
      ? raw.nextTeacherUser || null
      : null,
    nextTeacherRevealedAt: raw.nextTeacherRevealedAt || null,
    collaboration: {
      whiteboard: {
        content: raw.whiteboard?.content || "",
        updatedAt: raw.whiteboard?.updatedAt || null,
        updatedBy: raw.whiteboard?.updatedBy || null,
        strokes: raw.whiteboard?.strokes || [],
        snapshots: raw.whiteboard?.snapshots || [],
      },
      breakMedia: {
        queue: raw.breakMedia?.queue || [],
        currentTrackIndex: raw.breakMedia?.currentTrackIndex || 0,
        isPlaying: raw.breakMedia?.isPlaying || false,
        playbackPositionSeconds: raw.breakMedia?.playbackPositionSeconds || 0,
        lastActionAt: raw.breakMedia?.lastActionAt || null,
        syncedBy: raw.breakMedia?.syncedBy || null,
        theme: raw.breakMedia?.theme || DEFAULT_BREAK_THEME,
        activityFeed: raw.breakMedia?.activityFeed || [],
        availableThemes: Object.entries(BREAK_THEME_LIBRARY).map(
          ([key, value]) => ({
            key,
            ...value,
          }),
        ),
        currentTrack:
          raw.breakMedia?.queue?.[raw.breakMedia?.currentTrackIndex || 0] ||
          null,
      },
    },
    summaries: raw.summaries || [],
  };
};

const populateSession = session =>
  session.populate([
    {
      path: "createdBy",
      select: "name email",
    },
    {
      path: "teacherUser",
      select: "name email",
    },
    {
      path: "nextTeacherUser",
      select: "name email primaryInterest",
    },
    {
      path: "participants.user",
      select: "name email primaryInterest",
    },
    {
      path: "quiz.submissions.user",
      select: "name email",
    },
    {
      path: "whiteboard.updatedBy",
      select: "name email",
    },
    {
      path: "whiteboard.snapshots.updatedBy",
      select: "name email",
    },
    {
      path: "breakMedia.queue.addedBy",
      select: "name email",
    },
    {
      path: "breakMedia.activityFeed.createdBy",
      select: "name email",
    },
    {
      path: "breakMedia.syncedBy",
      select: "name email",
    },
  ]);

const emitSessionState = async groupId => {
  const io = getIO();
  if (!io) return;
  const session = await findSessionForClient(groupId);

  io.to(sessionRoomId(groupId)).emit(
    "session:state",
    serializeSessionForClient(session),
  );
};

const clearSessionTimer = groupId => {
  const key = groupId.toString();
  const existing = sessionTimers.get(key);
  if (existing) {
    clearTimeout(existing);
    sessionTimers.delete(key);
  }
};

const clearSessionWarning = groupId => {
  const key = groupId.toString();
  const existing = sessionWarnings.get(key);
  if (existing) {
    clearTimeout(existing);
    sessionWarnings.delete(key);
  }
};

const chooseNextTeacherFromPresentParticipants = async session => {
  const presentIds = session.participants
    .filter(participant => participant.isOnline)
    .map(participant => participant.user);
  const memberIds = presentIds.length
    ? presentIds
    : session.participants.map(participant => participant.user);
  const currentTeacherId = session.teacherUser?.toString();
  const eligibleIds =
    memberIds.length > 1
      ? memberIds.filter(id => id.toString() !== currentTeacherId)
      : memberIds;
  const recentTeacherIds = await getRecentTeacherSelectionHistory(session);
  return pickNextTeacher(eligibleIds, recentTeacherIds);
};

const getAvailableTeacherCandidates = session => {
  const onlineParticipants = session.participants.filter(
    isParticipantAvailableForTeaching,
  );
  return onlineParticipants.length ? onlineParticipants : session.participants;
};

const maybeWarnTeachingWrapUp = groupId => {
  const io = getIO();
  if (!io) return;

  io.to(sessionRoomId(groupId)).emit("session:teachingWarning", {
    type: "round-up",
    message: "Teaching time will soon be over. Round up the explanation now.",
  });
};

const applyTeacherAssignment = (session, teacherUser) => {
  session.teacherUser = teacherUser;
  session.teacherHistory.push(teacherUser);
  const participant = session.participants.find(
    item => item.user.toString() === teacherUser.toString(),
  );
  if (participant) {
    participant.teachingTurns += 1;
  }
};

const applyQuizForRound = async session => {
  const populated = await session.populate([
    {
      path: "participants.user",
      select: "name email primaryInterest",
    },
    {
      path: "group",
      select: "name topic",
      model: "Group",
    },
  ]);

  const topic = resolveTopic({
    group: populated.group,
    participants: populated.participants,
  });
  const materialText = resolveSessionMaterial(populated);
  const sourceLabel = resolveMaterialSourceLabel(populated);
  const aiQuiz = await Promise.race([
    generateQuizWithOpenAI({
      topic,
      materialText,
      sourceLabel,
    }).catch(() => null),
    new Promise(resolve => setTimeout(() => resolve(null), 2500)),
  ]);
  const materialQuiz = buildMaterialQuiz({
    topic,
    materialText,
  });

  const normalizedAiQuiz =
    Array.isArray(aiQuiz) && aiQuiz.length ? aiQuiz : null;

  session.quiz.topic = topic;
  session.quiz.source = normalizedAiQuiz
    ? "ai-session-material"
    : materialQuiz
      ? "session-material"
      : "fallback";
  session.quiz.questions =
    normalizedAiQuiz ||
    materialQuiz ||
    buildQuiz(topic);
  session.quiz.submissions = [];
  session.quiz.releasedAt = new Date();
};

const schedulePhaseAdvance = session => {
  clearSessionTimer(session.group);
  clearSessionWarning(session.group);
  if (session.status !== "active" || !session.phaseEndsAt) return;

  const remainingMs = new Date(session.phaseEndsAt).getTime() - Date.now();
  const delay = Math.max(remainingMs, 0);
  const safeDelay = delay === 0 ? 50 : delay;
  const timeout = setTimeout(() => {
    advanceSessionPhase(session.group).catch(err => {
      console.error("Session phase advance error:", err);
    });
  }, safeDelay);

  sessionTimers.set(session.group.toString(), timeout);

  if (session.currentPhase === "teaching") {
    const phaseMs = durationForPhase(session.settings, "teaching");
    const warningMs = phaseMs > 5 * 60 * 1000 ? 5 * 60 * 1000 : 30 * 1000;
    const warningDelay = Math.max(delay - warningMs, 0);
    const warningTimeout = setTimeout(() => {
      maybeWarnTeachingWrapUp(session.group);
    }, warningDelay);
    sessionWarnings.set(session.group.toString(), warningTimeout);
  }
};

export const advanceSessionPhase = async groupId => {
  const session = await StudySession.findOne({
    group: groupId,
    status: "active",
  });

  if (!session) return null;

  if (session.currentPhase === "reveal") {
    const group = await Group.findById(groupId);
    session.status = "ended";
    session.phaseEndsAt = null;
    session.breakMedia.isPlaying = false;
    session.breakMedia.playbackPositionSeconds = 0;
    session.endedReason = "completed";
    clearEndedSessionContent(session);
    if (group) {
      persistNextTeacherToGroupPlan({
        group,
        session,
        finalizedBy: session.createdBy,
      });
    }
    await updateStudyStreaksForCompletedSession(session);
    await session.save();
    if (group) {
      await group.save();
    }
    clearSessionTimer(groupId);
    clearSessionWarning(groupId);
    await emitSessionState(groupId);
    return null;
  }

  const previousPhase = session.currentPhase;
  const nextIndex = (session.phaseIndex + 1) % PHASES.length;
  const nextPhase = PHASES[nextIndex];

  session.phaseIndex = nextIndex;
  session.currentPhase = nextPhase;
  session.phaseStartedAt = new Date();
  session.phaseEndsAt = new Date(
    Date.now() + durationForPhase(session.settings, nextPhase),
  );

  if (nextPhase === "break") {
    session.summaries.push(buildSessionSummary(session));
    session.breakMedia.theme =
      session.breakMedia?.theme || DEFAULT_BREAK_THEME;
    appendBreakActivity(session, {
      type: "phase",
      label: "Break lounge opened",
      detail: BREAK_THEME_LIBRARY[session.breakMedia.theme]?.description || "",
    });
    if (session.breakMedia?.queue?.length) {
      session.breakMedia.isPlaying = true;
      session.breakMedia.playbackPositionSeconds = 0;
      session.breakMedia.lastActionAt = new Date();
      appendBreakActivity(session, {
        type: "music",
        label: "Music started",
        detail: session.breakMedia.queue[
          session.breakMedia.currentTrackIndex || 0
        ]?.title
          ? `Now playing ${session.breakMedia.queue[session.breakMedia.currentTrackIndex || 0].title}`
          : "The room soundtrack is now live.",
      });
    }
  } else if (session.breakMedia) {
    session.breakMedia.isPlaying = false;
    session.breakMedia.playbackPositionSeconds = 0;
    if (previousPhase === "break") {
      appendBreakActivity(session, {
        type: "phase",
        label: "Break lounge closed",
        detail: "The room is transitioning to the next mode.",
      });
    }
  }

  if (nextPhase === "quiz") {
    await applyQuizForRound(session);
  }

  if (nextPhase === "reveal") {
    session.nextTeacherUser = await chooseNextTeacherFromPresentParticipants(
      session,
    );
    session.selectedBySystemAt = new Date();
    session.revealAvailableTo = "creator";
    session.nextTeacherRevealedAt = null;
  }

  session.participants = session.participants.map(participant => ({
    ...participant.toObject(),
    speakRequested: false,
    speakApproved: false,
    speakMuted: false,
  }));
  session.activePrompt = "";

  await session.save();
  await emitSessionState(groupId);
  schedulePhaseAdvance(session);
  return session;
};

const ensureGroupAccess = async (groupId, userId) => {
  if (!mongoose.Types.ObjectId.isValid(groupId)) {
    return { error: "Invalid group ID" };
  }

  const group = await Group.findById(groupId);
  if (!group) return { error: "Group not found", status: 404 };
  if (!isMember(group, userId)) {
    return { error: "Not authorized for group", status: 403 };
  }

  return { group };
};

const isGroupCreator = (group, userId) =>
  group.createBy?.toString() === userId.toString();

const ensureTeacherControl = session => (req, res) => {
  const userId = req.user._id.toString();
  const teacherId = session.teacherUser?.toString();

  if (teacherId !== userId) {
    res.status(403).json({
      message: "Only the current teacher can control this live session action",
    });
    return false;
  }

  return true;
};

const ensureTeacherOrGroupCreator = (session, group) => (req, res) => {
  const userId = req.user._id.toString();
  const teacherId = session.teacherUser?.toString();

  if (teacherId !== userId && !isGroupCreator(group, userId)) {
    res.status(403).json({
      message: "Only the current teacher or group creator can do that",
    });
    return false;
  }

  return true;
};

const createSeededLobbySession = async (
  group,
  createdBy,
  { teacherOverride = null } = {},
) => {
  const onlineUserIds = getOnlineUserIdsForGroup(group._id);
  const sessionSettings = normalizeSessionSettings(group.sessionSettings);
  const nextPlan = group.nextSessionPlan || {};
  const persistedTeacherSession = await StudySession.findOne({
    group: group._id,
    nextTeacherUser: { $ne: null },
  })
    .sort({ updatedAt: -1 })
    .select("nextTeacherUser nextTeacherRevealedAt");
  const persistedNextTeacher =
    nextPlan.teacherUser || persistedTeacherSession?.nextTeacherUser || null;
  const initialTeacher =
    teacherOverride || persistedNextTeacher || group.createBy || null;

  return StudySession.create({
    group: group._id,
    createdBy,
    teacherUser: initialTeacher,
    nextTeacherUser: persistedNextTeacher,
    nextTeacherRevealedAt:
      nextPlan.teacherRevealedAt ||
      persistedTeacherSession?.nextTeacherRevealedAt ||
      null,
    scheduledFor: nextPlan.scheduledFor || null,
    planning: {
      focusTopic: nextPlan.topic || group.topic || "",
      prepNotes: nextPlan.prepNotes || "",
      sourceType: "topic",
      sourceLabel: "",
      sourceLink: "",
      sourceText: "",
    },
    participants: buildParticipantSeed(group, onlineUserIds),
    settings: sessionSettings,
  });
};

const resolveAssignedLobbyTeacher = async group => {
  const nextPlanTeacher = group.nextSessionPlan?.teacherUser || null;
  if (nextPlanTeacher) {
    return nextPlanTeacher;
  }

  const persistedTeacherSession = await StudySession.findOne({
    group: group._id,
    nextTeacherUser: { $ne: null },
  })
    .sort({ updatedAt: -1 })
    .select("nextTeacherUser");

  return persistedTeacherSession?.nextTeacherUser || null;
};

export const getCurrentSession = async (req, res) => {
  try {
    const { groupId } = req.params;
    const access = await ensureGroupAccess(groupId, req.user._id);
    if (access.error) {
      return res.status(access.status || 400).json({ message: access.error });
    }

    const session = await findSessionForClient(groupId);

    if (!session) {
      return res.json(null);
    }

    res.json(serializeSessionForClient(session));
  } catch (err) {
    console.error("Get session error:", err);
    res.status(500).json({ message: "Failed to load session" });
  }
};

export const updateSessionPlan = async (req, res) => {
  try {
    const { groupId } = req.params;
    const {
      focusTopic = "",
      prepNotes = "",
      sourceType = "topic",
      sourceLabel = "",
      sourceLink = "",
      sourceText = "",
    } = req.body;
    const access = await ensureGroupAccess(groupId, req.user._id);
    if (access.error) {
      return res.status(access.status || 400).json({ message: access.error });
    }

    let session = await StudySession.findOne({
      group: groupId,
      status: { $in: ["lobby", "active"] },
    }).sort({ createdAt: -1 });

    if (!session) {
      session = await createSeededLobbySession(access.group, req.user._id);
    }

    const isTeacher =
      session?.teacherUser?.toString() === req.user._id.toString();
    if (!isTeacher) {
      return res.status(403).json({
        message: "Only the current teacher can update live teaching materials",
      });
    }

    session.planning.focusTopic = focusTopic.trim();
    session.planning.prepNotes = prepNotes.trim();
    session.planning.sourceType = sourceType;
    session.planning.sourceLabel = sourceLabel.trim();
    session.planning.sourceLink = sourceLink.trim();
    session.planning.sourceText = sourceText.trim();
    session.teacherPrepared = true;
    session.teacherReadyAt = session.teacherReadyAt || new Date();

    await session.save();

    const populated = await populateSession(session);
    await emitSessionState(groupId);
    res.json(serializeSessionForClient(populated));
  } catch (err) {
    console.error("Update session plan error:", err);
    res.status(500).json({ message: "Failed to update session plan" });
  }
};

export const importSessionMaterial = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { fileName = "", mimeType = "", contentBase64 = "" } = req.body;
    const access = await ensureGroupAccess(groupId, req.user._id);
    if (access.error) {
      return res.status(access.status || 400).json({ message: access.error });
    }

    let session = await StudySession.findOne({
      group: groupId,
      status: { $in: ["lobby", "active"] },
    }).sort({ createdAt: -1 });

    if (!session) {
      session = await createSeededLobbySession(access.group, req.user._id);
    }

    const isTeacher =
      session?.teacherUser?.toString() === req.user._id.toString();
    if (!isTeacher) {
      return res.status(403).json({
        message: "Only the current teacher can import teaching material",
      });
    }

    const imported = await importStudyMaterial({
      fileName,
      mimeType,
      contentBase64,
    });

    session.planning.sourceType = imported.sourceType;
    session.planning.sourceLabel = imported.sourceLabel;
    session.planning.sourceText = imported.sourceText;
    session.teacherPrepared = true;
    session.teacherReadyAt = session.teacherReadyAt || new Date();

    await session.save();
    const populated = await populateSession(session);
    await emitSessionState(groupId);
    res.json({
      ...serializeSessionForClient(populated),
      importedMaterial: imported,
    });
  } catch (err) {
    console.error("Import session material error:", err);
    res.status(500).json({
      message: err.message || "Failed to import and parse session material",
    });
  }
};

export const withdrawSessionMaterial = async (req, res) => {
  try {
    const { groupId } = req.params;
    const access = await ensureGroupAccess(groupId, req.user._id);
    if (access.error) {
      return res.status(access.status || 400).json({ message: access.error });
    }

    let session = await StudySession.findOne({
      group: groupId,
      status: { $in: ["lobby", "active"] },
    }).sort({ createdAt: -1 });

    if (!session) {
      session = await createSeededLobbySession(access.group, req.user._id);
    }

    const isTeacher =
      session?.teacherUser?.toString() === req.user._id.toString();
    if (!isTeacher) {
      return res.status(403).json({
        message: "Only the current teacher can withdraw session material",
      });
    }

    session.planning.sourceType = "topic";
    session.planning.sourceLabel = "";
    session.planning.sourceLink = "";
    session.planning.sourceText = "";
    session.teacherPrepared = Boolean(
      session.planning.focusTopic?.trim() || session.planning.prepNotes?.trim(),
    );
    if (!session.teacherPrepared) {
      session.teacherReadyAt = null;
    }

    await session.save();
    const populated = await populateSession(session);
    await emitSessionState(groupId);
    res.json({
      ...serializeSessionForClient(populated),
      withdrawnMaterial: true,
    });
  } catch (err) {
    console.error("Withdraw session material error:", err);
    res.status(500).json({
      message: err.message || "Failed to withdraw session material",
    });
  }
};

export const voteForSessionTime = async (req, res) => {
  return res.status(410).json({
    message: "Next-session time voting now lives on the group plan endpoints",
  });
};

export const finalizeSessionPlan = async (req, res) => {
  return res.status(410).json({
    message:
      "Next-session planning is no longer finalized from the live session API",
  });
};

export const createLobby = async (req, res) => {
  try {
    const { groupId } = req.params;
    const access = await ensureGroupAccess(groupId, req.user._id);
    if (access.error) {
      return res.status(access.status || 400).json({ message: access.error });
    }

    const creator = await User.findById(access.group.createBy).select(
      "isOnlineOnApp",
    );
    const creatorUnavailable = !creator?.isOnlineOnApp;
    const plannedScheduledTime = access.group.nextSessionPlan?.scheduledFor || null;
    const plannedScheduledTimeReached =
      !!plannedScheduledTime &&
      Date.now() >= new Date(plannedScheduledTime).getTime() + 1000;
    const assignedLobbyTeacher = await resolveAssignedLobbyTeacher(access.group);
    const isCreator = isGroupCreator(access.group, req.user._id);
    const isAssignedTeacher =
      assignedLobbyTeacher?.toString() === req.user._id.toString();
    const canFallbackTeacherOpenLobby =
      !isCreator &&
      isAssignedTeacher &&
      creatorUnavailable &&
      plannedScheduledTimeReached;

    let session = await StudySession.findOne({
      group: groupId,
      status: { $in: ["lobby", "active"] },
    }).sort({ createdAt: -1 });

    if (!session) {
      if (!isCreator && !canFallbackTeacherOpenLobby) {
        return res.status(403).json({
          message:
            "Only the creator can open the lobby early. The assigned teacher can do it after the scheduled time if the creator is unavailable.",
        });
      }
      session = await createSeededLobbySession(access.group, req.user._id, {
        teacherOverride: canFallbackTeacherOpenLobby ? req.user._id : null,
      });
    }

    const sessionTeacherMatchesUser =
      session.teacherUser?.toString() === req.user._id.toString() ||
      assignedLobbyTeacher?.toString() === req.user._id.toString();
    const scheduledTimeReached =
      !!session.scheduledFor &&
      Date.now() >= new Date(session.scheduledFor).getTime() + 1000;
    if (!isCreator && !(sessionTeacherMatchesUser && creatorUnavailable && scheduledTimeReached)) {
      return res.status(403).json({
        message:
          "Only the creator can open the lobby early. The assigned teacher can do it after the scheduled time if the creator is unavailable.",
      });
    }

    const populated = await populateSession(session);
    await emitSessionState(groupId);
    res.status(201).json(serializeSessionForClient(populated));
  } catch (err) {
    console.error("Create lobby error:", err);
    res.status(500).json({ message: "Failed to create session lobby" });
  }
};

export const startSession = async (req, res) => {
  try {
    const { groupId } = req.params;
    const access = await ensureGroupAccess(groupId, req.user._id);
    if (access.error) {
      return res.status(access.status || 400).json({ message: access.error });
    }

    let session = await StudySession.findOne({
      group: groupId,
      status: { $in: ["lobby", "active"] },
    }).sort({ createdAt: -1 });

    if (!session) {
      session = await createSeededLobbySession(
        access.group,
        access.group.createBy,
      );
    }

    if (session.status === "active") {
      const populated = await populateSession(session);
      return res.json(serializeSessionForClient(populated));
    }

    const isCreator = isGroupCreator(access.group, req.user._id);
    const isAssignedTeacher =
      session.teacherUser?.toString() === req.user._id.toString();
    const scheduledReady =
      !!session.scheduledFor &&
      Date.now() >= new Date(session.scheduledFor).getTime() + 1000;
    const creator = await User.findById(access.group.createBy).select(
      "isOnlineOnApp",
    );
    const creatorUnavailable = !creator?.isOnlineOnApp;
    if (
      !isCreator &&
      !(isAssignedTeacher && creatorUnavailable && scheduledReady)
    ) {
      return res.status(403).json({
        message:
          "Only the creator can start early. The assigned teacher can only start after the scheduled time if the creator is unavailable.",
      });
    }

    session.participants = access.group.members.map(memberId => {
      const existing = session.participants.find(
        participant => participant.user.toString() === memberId.toString(),
      );
      return (
        existing || {
          user: memberId,
          isOnline: false,
        }
      );
    });
    const memberIds = access.group.members;
    const isFirstTeachingTurn = !session.teacherHistory?.length;
    const explicitAssignedTeacher =
      session.teacherUser &&
      memberIds.some(id => id.toString() === session.teacherUser.toString())
        ? session.teacherUser
        : session.nextTeacherUser &&
            memberIds.some(
              id => id.toString() === session.nextTeacherUser.toString(),
            )
          ? session.nextTeacherUser
          : null;
    let teacherUser = explicitAssignedTeacher;
    if (!teacherUser) {
      teacherUser =
        isFirstTeachingTurn &&
        memberIds.some(id => id.toString() === access.group.createBy.toString())
          ? access.group.createBy
          : await chooseNextTeacherFromPresentParticipants(session);
    }

    const teacherParticipant = session.participants.find(
      participant => participant.user.toString() === teacherUser.toString(),
    );
    if (!isParticipantAvailableForTeaching(teacherParticipant)) {
      return res.status(400).json({
        message:
          "The assigned teacher is not currently available. Wait for them to come online before starting.",
      });
    }
    if (!session.teacherPrepared) {
      return res.status(400).json({
        message:
          "The assigned teacher needs to mark the lobby as ready before the session can start.",
      });
    }
    session.status = "active";
    session.phaseIndex = 0;
    session.currentPhase = "teaching";
    applyTeacherAssignment(session, teacherUser);
    session.phaseStartedAt = new Date();
    session.phaseEndsAt = new Date(
      Date.now() + durationForPhase(session.settings, "teaching"),
    );
    session.teacherPrepared = false;
    session.teacherReadyAt = null;
    session.chatFrozen = false;
    session.activePrompt = "";
    session.nextTeacherRevealedAt = null;
    session.selectedBySystemAt = null;
    session.revealAvailableTo = "none";
    session.participants = session.participants.map(participant => ({
      ...participant.toObject(),
      isOnline: getOnlineUserIdsForGroup(groupId).includes(
        participant.user.toString(),
      ),
      speakRequested: false,
      speakApproved: false,
      speakMuted: false,
      lastSeenAt: new Date(),
    }));
    session.breakMedia.isPlaying = false;
    session.breakMedia.currentTrackIndex = 0;
    session.breakMedia.playbackPositionSeconds = 0;
    session.breakMedia.lastActionAt = null;

    await session.save();
    await emitSessionState(groupId);
    schedulePhaseAdvance(session);

    const populated = await populateSession(session);
    res.json(serializeSessionForClient(populated));
  } catch (err) {
    console.error("Start session error:", err);
    res.status(500).json({ message: "Failed to start session" });
  }
};

export const markTeacherReady = async (req, res) => {
  try {
    const { groupId } = req.params;
    const access = await ensureGroupAccess(groupId, req.user._id);
    if (access.error) {
      return res.status(access.status || 400).json({ message: access.error });
    }

    const session = await StudySession.findOne({
      group: groupId,
      status: "lobby",
    }).sort({ createdAt: -1 });

    if (!session) {
      return res.status(404).json({ message: "No lobby session found" });
    }

    if (session.teacherUser?.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        message: "Only the assigned teacher can mark the lobby as ready",
      });
    }

    session.teacherPrepared = true;
    session.teacherReadyAt = new Date();
    await session.save();
    const populated = await populateSession(session);
    await emitSessionState(groupId);
    res.json(serializeSessionForClient(populated));
  } catch (err) {
    console.error("Teacher ready error:", err);
    res.status(500).json({ message: "Failed to mark the teacher as ready" });
  }
};

export const revealNextTeacher = async (req, res) => {
  try {
    const { groupId } = req.params;
    const access = await ensureGroupAccess(groupId, req.user._id);
    if (access.error) {
      return res.status(access.status || 400).json({ message: access.error });
    }

    const session = await StudySession.findOne({
      group: groupId,
      status: "active",
      currentPhase: "reveal",
    }).sort({ createdAt: -1 });

    if (!session) {
      return res
        .status(404)
        .json({ message: "No teacher reveal is active right now" });
    }

    const userId = req.user._id.toString();
    const teacherId = session.teacherUser?.toString();
    const isCreator = isGroupCreator(access.group, req.user._id);
    const canReveal =
      (session.revealAvailableTo === "creator" && isCreator) ||
      (session.revealAvailableTo === "teacher" && teacherId === userId);

    if (!canReveal) {
      return res.status(403).json({
        message: "You cannot reveal the next teacher right now",
      });
    }

    session.nextTeacherRevealedAt = new Date();
    persistNextTeacherToGroupPlan({
      group: access.group,
      session,
      finalizedBy: req.user._id,
    });
    await session.save();
    await access.group.save();
    const populated = await populateSession(session);
    await emitSessionState(groupId);
    res.json(serializeSessionForClient(populated));
  } catch (err) {
    console.error("Reveal next teacher error:", err);
    res.status(500).json({ message: "Failed to reveal the next teacher" });
  }
};

export const endSession = async (req, res) => {
  try {
    const { groupId } = req.params;
    const access = await ensureGroupAccess(groupId, req.user._id);
    if (access.error) {
      return res.status(access.status || 400).json({ message: access.error });
    }

    const session = await StudySession.findOne({
      group: groupId,
      status: { $in: ["lobby", "active"] },
    }).sort({ createdAt: -1 });

    if (!session) {
      return res.status(404).json({ message: "No session found" });
    }

    if (!ensureTeacherOrGroupCreator(session, access.group)(req, res)) {
      return;
    }

    session.status = "ended";
    session.phaseEndsAt = null;
    session.breakMedia.isPlaying = false;
    session.breakMedia.playbackPositionSeconds = 0;
    const shouldSelectFreshTeacher =
      !session.selectedBySystemAt || !session.nextTeacherUser;
    if (shouldSelectFreshTeacher) {
      session.nextTeacherUser = await chooseNextTeacherFromPresentParticipants(
        session,
      );
      session.selectedBySystemAt = new Date();
      session.nextTeacherRevealedAt = null;
      session.revealAvailableTo = "creator";
    }
    session.endedReason = "manual";
    session.summaries.push(buildSessionSummary(session));
    clearEndedSessionContent(session);
    persistNextTeacherToGroupPlan({
      group: access.group,
      session,
      finalizedBy: req.user._id,
    });
    await updateStudyStreaksForCompletedSession(session);
    await session.save();
    await access.group.save();
    clearSessionTimer(groupId);
    clearSessionWarning(groupId);
    await emitSessionState(groupId);

    const populated = await populateSession(session);
    res.json(serializeSessionForClient(populated));
  } catch (err) {
    console.error("End session error:", err);
    res.status(500).json({ message: "Failed to end session" });
  }
};

export const advancePhaseManually = async (req, res) => {
  try {
    const { groupId } = req.params;
    const access = await ensureGroupAccess(groupId, req.user._id);
    if (access.error) {
      return res.status(access.status || 400).json({ message: access.error });
    }

    const session = await StudySession.findOne({
      group: groupId,
      status: { $in: ["lobby", "active"] },
    }).sort({ createdAt: -1 });

    if (!session) {
      return res.status(404).json({ message: "No active session found" });
    }

    if (!ensureTeacherControl(session)(req, res)) {
      return;
    }

    const updated = await advanceSessionPhase(groupId);
    const populated = updated ? await populateSession(updated) : null;
    res.json(serializeSessionForClient(populated));
  } catch (err) {
    console.error("Manual phase advance error:", err);
    res.status(500).json({ message: "Failed to advance session phase" });
  }
};

export const toggleChatFreeze = async (req, res) => {
  try {
    const { groupId } = req.params;
    const access = await ensureGroupAccess(groupId, req.user._id);
    if (access.error) {
      return res.status(access.status || 400).json({ message: access.error });
    }

    const session = await StudySession.findOne({
      group: groupId,
      status: "active",
    }).sort({ createdAt: -1 });

    if (!session) {
      return res.status(404).json({ message: "No active session found" });
    }

    if (!ensureTeacherControl(session)(req, res)) {
      return;
    }

    session.chatFrozen = !session.chatFrozen;
    await session.save();
    const populated = await populateSession(session);
    await emitSessionState(groupId);
    res.json(serializeSessionForClient(populated));
  } catch (err) {
    console.error("Toggle chat freeze error:", err);
    res.status(500).json({ message: "Failed to update chat freeze" });
  }
};

export const updateSessionPrompt = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { prompt = "" } = req.body;
    const access = await ensureGroupAccess(groupId, req.user._id);
    if (access.error) {
      return res.status(access.status || 400).json({ message: access.error });
    }

    const session = await StudySession.findOne({
      group: groupId,
      status: "active",
    }).sort({ createdAt: -1 });

    if (!session) {
      return res.status(404).json({ message: "No active session found" });
    }

    if (!ensureTeacherControl(session)(req, res)) {
      return;
    }

    session.activePrompt = prompt.trim();
    await session.save();
    const populated = await populateSession(session);
    await emitSessionState(groupId);
    res.json(serializeSessionForClient(populated));
  } catch (err) {
    console.error("Update session prompt error:", err);
    res.status(500).json({ message: "Failed to update session prompt" });
  }
};

export const submitQuizAnswers = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { answers = [] } = req.body;
    const access = await ensureGroupAccess(groupId, req.user._id);
    if (access.error) {
      return res.status(access.status || 400).json({ message: access.error });
    }

    const session = await StudySession.findOne({
      group: groupId,
      status: "active",
    }).sort({ createdAt: -1 });

    if (!session) {
      return res.status(404).json({ message: "No active session found" });
    }

    if (session.currentPhase !== "quiz") {
      return res.status(400).json({ message: "Quiz mode is not active" });
    }

    const existingSubmission = session.quiz.submissions.find(
      submission => submission.user.toString() === req.user._id.toString(),
    );

    if (existingSubmission) {
      return res.status(400).json({ message: "Quiz already submitted" });
    }

    const score = session.quiz.questions.reduce((total, question, index) => {
      return (
        total + (Number(answers[index]) === question.correctAnswer ? 1 : 0)
      );
    }, 0);

    session.quiz.submissions.push({
      user: req.user._id,
      answers,
      score,
      submittedAt: new Date(),
    });

    const participant = session.participants.find(
      item => item.user.toString() === req.user._id.toString(),
    );

    if (participant) {
      participant.quizScoreTotal += score;
      participant.quizzesCompleted += 1;
      participant.lastQuizScore = score;
      participant.lastSeenAt = new Date();
    }

    await session.save();

    const activeParticipantCount =
      session.participants.filter(participant => participant.isOnline).length ||
      session.participants.length;
    const everyoneSubmitted =
      session.quiz.submissions.length >= activeParticipantCount;

    if (everyoneSubmitted) {
      clearSessionTimer(groupId);
      clearSessionWarning(groupId);
      const advancedSession = await advanceSessionPhase(groupId);
      const clientSession = advancedSession
        ? await populateSession(advancedSession)
        : await findSessionForClient(groupId);
      return res.json(serializeSessionForClient(clientSession));
    }

    const populated = await populateSession(session);
    await emitSessionState(groupId);
    res.json(serializeSessionForClient(populated));
  } catch (err) {
    console.error("Quiz submission error:", err);
    res.status(500).json({ message: "Failed to submit quiz answers" });
  }
};

export const approveSpeakRequest = async (req, res) => {
  try {
    const { groupId, userId } = req.params;
    const { approved, action } = req.body;
    const access = await ensureGroupAccess(groupId, req.user._id);
    if (access.error) {
      return res.status(access.status || 400).json({ message: access.error });
    }

    const session = await StudySession.findOne({
      group: groupId,
      status: "active",
    }).sort({ createdAt: -1 });

    if (!session) {
      return res.status(404).json({ message: "No active session found" });
    }

    if (!ensureTeacherControl(session)(req, res)) {
      return;
    }

    const participant = session.participants.find(
      item => item.user.toString() === userId,
    );

    if (!participant) {
      return res.status(404).json({ message: "Participant not found" });
    }

    const resolvedAction =
      action ||
      (approved === true
        ? "approve"
        : approved === false
          ? "revoke"
          : "approve");

    if (resolvedAction === "approve") {
      participant.speakApproved = true;
      participant.speakMuted = false;
      participant.speakRevoked = false;
      participant.speakRequested = false;
      participant.speakApprovals += 1;
    } else if (resolvedAction === "revoke") {
      participant.speakApproved = false;
      participant.speakMuted = true;
      participant.speakRevoked = true;
      participant.speakRequested = false;
    } else if (resolvedAction === "mute") {
      participant.speakApproved = true;
      participant.speakMuted = true;
      participant.speakRevoked = false;
      participant.speakRequested = false;
    } else if (resolvedAction === "unmute") {
      participant.speakApproved = true;
      participant.speakMuted = false;
      participant.speakRevoked = false;
      participant.speakRequested = false;
    } else {
      return res.status(400).json({ message: "Unsupported speaking action" });
    }
    participant.lastSeenAt = new Date();

    await session.save();
    const populated = await populateSession(session);
    await emitSessionState(groupId);
    res.json(serializeSessionForClient(populated));
  } catch (err) {
    console.error("Approve speak request error:", err);
    res.status(500).json({ message: "Failed to update speaking permission" });
  }
};

export const updateWhiteboard = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { content = "", strokes, clear = false } = req.body;
    const access = await ensureGroupAccess(groupId, req.user._id);
    if (access.error) {
      return res.status(access.status || 400).json({ message: access.error });
    }

    const session = await syncWhiteboardState({
      groupId,
      userId: req.user._id,
      content,
      strokes,
      clear,
    });
    const populated = await populateSession(session);
    await emitSessionState(groupId);
    res.json(serializeSessionForClient(populated));
  } catch (err) {
    console.error("Update whiteboard error:", err);
    res.status(500).json({ message: "Failed to update whiteboard" });
  }
};

export const syncWhiteboardState = async ({
  groupId,
  userId,
  content = "",
  strokes,
  clear = false,
}) => {
  const session = await StudySession.findOne({
    group: groupId,
    status: "active",
  }).sort({ createdAt: -1 });

  if (!session) {
    throw new Error("No active session found");
  }

  const participant = session.participants.find(
    item => item.user.toString() === userId.toString(),
  );

  if (!canEditWhiteboard({ session, participant, userId })) {
    throw new Error("You cannot edit the whiteboard in the current mode");
  }

  const previousContent = session.whiteboard.content || "";
  session.whiteboard.content = content;
  if (Array.isArray(strokes)) {
    session.whiteboard.strokes = strokes.slice(-120);
  }
  if (clear) {
    session.whiteboard.content = "";
    session.whiteboard.strokes = [];
  }
  session.whiteboard.updatedAt = new Date();
  session.whiteboard.updatedBy = userId;
  if (content.trim() && content.trim() !== previousContent.trim()) {
    session.whiteboard.snapshots.push({
      content,
      updatedAt: new Date(),
      updatedBy: userId,
    });
    session.whiteboard.snapshots = session.whiteboard.snapshots.slice(-6);
  }

  await session.save();
  return session;
};

export const canUserUseSessionAudio = async ({ groupId, userId }) => {
  const group = await Group.findById(groupId).select("createBy");
  if (!group) {
    return { allowed: false, reason: "Group not found" };
  }

  const session = await StudySession.findOne({
    group: groupId,
    status: { $in: ["lobby", "active"] },
  }).select("status currentPhase teacherUser participants");

  if (!session) {
    return { allowed: false, reason: "No active session found" };
  }

  const participant = session.participants.find(
    item => item.user.toString() === userId.toString(),
  );

  if (!participant && session.teacherUser?.toString() !== userId.toString()) {
    return { allowed: false, reason: "You are not part of this session" };
  }

  const allowed = canUseSessionAudioForState({
    session,
    participant,
    group,
    userId,
  });

  return {
    allowed,
    reason: allowed ? null : "Audio is not available for you in this phase yet",
  };
};

const normalizeBreakTrackUrl = url => {
  const value = String(url || "").trim();
  if (!value) return "";
  if (/^(https?:)?\/\//i.test(value)) return value;
  if (value.startsWith("/")) return value;
  const cleanValue = value.replace(/^\.\/+/, "").replace(/^\/+/, "");
  return `/music/${cleanValue}`;
};

export const addBreakTrack = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { title = "", url = "" } = req.body;
    const access = await ensureGroupAccess(groupId, req.user._id);
    if (access.error) {
      return res.status(access.status || 400).json({ message: access.error });
    }

    const session = await StudySession.findOne({
      group: groupId,
      status: { $in: ["lobby", "active"] },
    }).sort({ createdAt: -1 });

    if (!session) {
      return res.status(404).json({ message: "No session found" });
    }

    if (!title.trim()) {
      return res.status(400).json({ message: "Track title is required" });
    }

    session.breakMedia.queue.push({
      title: title.trim(),
      url: normalizeBreakTrackUrl(url),
      addedBy: req.user._id,
      addedAt: new Date(),
    });
    if (session.breakMedia.queue.length === 1) {
      session.breakMedia.currentTrackIndex = 0;
    }
    appendBreakActivity(session, {
      type: "music",
      label: "Track added",
      detail: title.trim(),
      createdBy: req.user._id,
    });

    await session.save();
    const populated = await populateSession(session);
    await emitSessionState(groupId);
    res.json(serializeSessionForClient(populated));
  } catch (err) {
    console.error("Add break track error:", err);
    res.status(500).json({ message: "Failed to add break track" });
  }
};

export const controlBreakMedia = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { action } = req.body;
    const access = await ensureGroupAccess(groupId, req.user._id);
    if (access.error) {
      return res.status(access.status || 400).json({ message: access.error });
    }

    const session = await StudySession.findOne({
      group: groupId,
      status: { $in: ["lobby", "active"] },
    }).sort({ createdAt: -1 });

    if (!session) {
      return res.status(404).json({ message: "No session found" });
    }

    if (!ensureTeacherControl(session)(req, res)) {
      return;
    }

    if (!session.breakMedia.queue.length) {
      return res
        .status(400)
        .json({ message: "Add a track before controlling playback" });
    }

    switch (action) {
      case "play":
        session.breakMedia.isPlaying = true;
        session.breakMedia.lastActionAt = new Date();
        appendBreakActivity(session, {
          type: "music",
          label: "Playback started",
          detail:
            session.breakMedia.queue[session.breakMedia.currentTrackIndex || 0]
              ?.title || "Room music resumed",
          createdBy: req.user._id,
        });
        break;
      case "pause":
        if (session.breakMedia.isPlaying && session.breakMedia.lastActionAt) {
          const elapsedSeconds = Math.max(
            0,
            (Date.now() - new Date(session.breakMedia.lastActionAt).getTime()) /
              1000,
          );
          session.breakMedia.playbackPositionSeconds =
            Math.max(0, session.breakMedia.playbackPositionSeconds || 0) +
            elapsedSeconds;
        }
        session.breakMedia.isPlaying = false;
        appendBreakActivity(session, {
          type: "music",
          label: "Playback paused",
          detail: "The room soundtrack was paused.",
          createdBy: req.user._id,
        });
        break;
      case "next":
        session.breakMedia.currentTrackIndex =
          (session.breakMedia.currentTrackIndex + 1) %
          session.breakMedia.queue.length;
        session.breakMedia.isPlaying = true;
        session.breakMedia.playbackPositionSeconds = 0;
        session.breakMedia.lastActionAt = new Date();
        appendBreakActivity(session, {
          type: "music",
          label: "Track skipped forward",
          detail:
            session.breakMedia.queue[session.breakMedia.currentTrackIndex]
              ?.title || "Next track selected",
          createdBy: req.user._id,
        });
        break;
      case "previous":
        session.breakMedia.currentTrackIndex =
          (session.breakMedia.currentTrackIndex -
            1 +
            session.breakMedia.queue.length) %
          session.breakMedia.queue.length;
        session.breakMedia.isPlaying = true;
        session.breakMedia.playbackPositionSeconds = 0;
        session.breakMedia.lastActionAt = new Date();
        appendBreakActivity(session, {
          type: "music",
          label: "Track moved back",
          detail:
            session.breakMedia.queue[session.breakMedia.currentTrackIndex]
              ?.title || "Previous track selected",
          createdBy: req.user._id,
        });
        break;
      default:
        return res.status(400).json({ message: "Unsupported media action" });
    }

    session.breakMedia.lastActionAt = new Date();
    session.breakMedia.syncedBy = req.user._id;

    await session.save();
    const populated = await populateSession(session);
    await emitSessionState(groupId);
    res.json(serializeSessionForClient(populated));
  } catch (err) {
    console.error("Control break media error:", err);
    res.status(500).json({ message: "Failed to control break media" });
  }
};

export const setBreakTheme = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { theme = "" } = req.body;
    const access = await ensureGroupAccess(groupId, req.user._id);
    if (access.error) {
      return res.status(access.status || 400).json({ message: access.error });
    }

    const session = await StudySession.findOne({
      group: groupId,
      status: { $in: ["lobby", "active"] },
    }).sort({ createdAt: -1 });

    if (!session) {
      return res.status(404).json({ message: "No session found" });
    }

    if (!ensureTeacherControl(session)(req, res)) {
      return;
    }

    if (!BREAK_THEME_LIBRARY[theme]) {
      return res.status(400).json({ message: "Unsupported break theme" });
    }

    session.breakMedia.theme = theme;
    appendBreakActivity(session, {
      type: "theme",
      label: `Room vibe set to ${BREAK_THEME_LIBRARY[theme].label}`,
      detail: BREAK_THEME_LIBRARY[theme].description,
      createdBy: req.user._id,
    });

    await session.save();
    const populated = await populateSession(session);
    await emitSessionState(groupId);
    res.json(serializeSessionForClient(populated));
  } catch (err) {
    console.error("Set break theme error:", err);
    res.status(500).json({ message: "Failed to update break theme" });
  }
};

export const getSessionHistory = async (req, res) => {
  try {
    const { groupId } = req.params;
    const access = await ensureGroupAccess(groupId, req.user._id);
    if (access.error) {
      return res.status(access.status || 400).json({ message: access.error });
    }

    const sessions = await StudySession.find({
      group: groupId,
      status: "ended",
    })
      .sort({ updatedAt: -1 })
      .limit(8)
      .populate([
        {
          path: "teacherUser",
          select: "name email",
        },
        {
          path: "createdBy",
          select: "name email",
        },
      ]);

    res.json(sessions.map(serializeHistoryItem));
  } catch (err) {
    console.error("Get session history error:", err);
    res.status(500).json({ message: "Failed to load session history" });
  }
};

export const markSessionPresence = async ({ groupId, userId, online }) => {
  const session = await StudySession.findOne({
    group: groupId,
    status: { $in: ["lobby", "active"] },
  });

  if (!session) return;

  const participant = session.participants.find(
    item => item.user.toString() === userId.toString(),
  );

  if (!participant) return;

  participant.isOnline = online;
  participant.lastSeenAt = new Date();
  await session.save();
  if (online) {
    await awardMeaningfulEngagement(userId);
  }
  await emitSessionState(groupId);
};

export const requestToSpeak = async ({ groupId, userId }) => {
  const session = await StudySession.findOne({
    group: groupId,
    status: "active",
  });

  if (!session) return null;

  const participant = session.participants.find(
    item => item.user.toString() === userId.toString(),
  );

  if (!participant) return null;

  const nextValue = !participant.speakRequested;
  participant.speakRequested = nextValue;
  participant.speakApproved = false;
  participant.speakMuted = false;
  if (nextValue) {
    participant.speakRequestsCount += 1;
  }
  participant.lastSeenAt = new Date();
  await session.save();
  await emitSessionState(groupId);
  return session;
};

export const recordSessionMessage = async ({
  groupId,
  userId,
  content = "",
}) => {
  const session = await StudySession.findOne({
    group: groupId,
    status: "active",
  });

  if (!session) return;

  const participant = session.participants.find(
    item => item.user.toString() === userId.toString(),
  );

  if (!participant) return;

  participant.messagesSent += 1;
  participant.isOnline = true;
  participant.lastSeenAt = new Date();
  await session.save();
  if (isMeaningfulMessage(content)) {
    await awardMeaningfulEngagement(userId);
  }
};

export const markUserOfflineInAllSessions = async userId => {
  const sessions = await StudySession.find({
    status: { $in: ["lobby", "active"] },
    "participants.user": userId,
  });

  for (const session of sessions) {
    const participant = session.participants.find(
      item => item.user.toString() === userId.toString(),
    );

    if (!participant) continue;

    participant.isOnline = false;
    participant.lastSeenAt = new Date();
    await session.save();
    await emitSessionState(session.group);
  }
};

export const autoStartScheduledSessions = async () => {
  const dueSessions = await StudySession.find({
    status: "lobby",
    scheduledFor: { $ne: null, $lte: new Date() },
  }).sort({ scheduledFor: 1 });

  for (const session of dueSessions) {
    try {
      const group = await Group.findById(session.group);
      if (!group || !group.isActive) continue;

      session.participants = group.members.map(memberId => {
        const existing = session.participants.find(
          participant => participant.user.toString() === memberId.toString(),
        );
        return (
          existing || {
            user: memberId,
            isOnline: false,
          }
        );
      });
      const memberIds = group.members;
      const teacherUser =
        session.nextTeacherUser &&
        memberIds.some(
          id => id.toString() === session.nextTeacherUser.toString(),
        )
          ? session.nextTeacherUser
          : await chooseNextTeacherFromPresentParticipants(session);

      const teacherParticipant = session.participants.find(
        participant => participant.user.toString() === teacherUser.toString(),
      );
      if (!isParticipantAvailableForTeaching(teacherParticipant)) {
        continue;
      }

      session.status = "active";
      session.phaseIndex = 0;
      session.currentPhase = "teaching";
      applyTeacherAssignment(session, teacherUser);
      session.phaseStartedAt = new Date();
      session.phaseEndsAt = new Date(
        Date.now() + durationForPhase(session.settings, "teaching"),
      );
      session.teacherPrepared = false;
      session.teacherReadyAt = null;
      session.chatFrozen = false;
      session.activePrompt = "";
      session.nextTeacherRevealedAt = null;
      session.selectedBySystemAt = null;
      session.revealAvailableTo = "none";
      session.participants = session.participants.map(participant => ({
        ...participant.toObject(),
        isOnline: getOnlineUserIdsForGroup(session.group).includes(
          participant.user.toString(),
        ),
        speakRequested: false,
        speakApproved: false,
        speakMuted: false,
        lastSeenAt: new Date(),
      }));
      session.breakMedia.isPlaying = false;
      session.breakMedia.currentTrackIndex = 0;
      session.breakMedia.playbackPositionSeconds = 0;
      session.breakMedia.lastActionAt = null;

      await session.save();
      await emitSessionState(session.group);
      schedulePhaseAdvance(session);
    } catch (err) {
      console.error("Auto start scheduled session error:", err);
    }
  }
};

export const canUserSendMessage = async ({ groupId, userId }) => {
  const session = await StudySession.findOne({
    group: groupId,
    status: "active",
  }).select("currentPhase teacherUser chatFrozen");

  if (!session) {
    return { allowed: true };
  }

  if (
    session.chatFrozen &&
    session.teacherUser?.toString() !== userId.toString()
  ) {
    return {
      allowed: false,
      reason: "Chat is temporarily frozen by the teacher",
    };
  }

  if (session.currentPhase === "quiz") {
    return { allowed: false, reason: "Chat is paused during quiz mode" };
  }

  if (
    session.currentPhase === "teaching" &&
    session.teacherUser?.toString() !== userId.toString()
  ) {
    const fullSession = await StudySession.findOne({
      group: groupId,
      status: "active",
    }).select("participants teacherUser currentPhase chatFrozen");

    const participant = fullSession?.participants?.find(
      item => item.user.toString() === userId.toString(),
    );

    if (participant?.speakApproved && !participant?.speakMuted) {
      return { allowed: true, session: fullSession };
    }

    return {
      allowed: false,
      reason: "Only the teacher can post during teaching mode",
    };
  }

  return { allowed: true, session };
};

export {
  emitSessionState,
  serializeSessionForClient,
  serializeWhiteboardForClient,
  sessionRoomId,
};
