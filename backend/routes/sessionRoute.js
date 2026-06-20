import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import {
  addBreakTrack,
  advancePhaseManually,
  approveSpeakRequest,
  controlBreakMedia,
  createLobby,
  endSession,
  finalizeSessionPlan,
  getCurrentSession,
  getSessionHistory,
  importSessionMaterial,
  markTeacherReady,
  revealNextTeacher,
  startSession,
  submitQuizAnswers,
  withdrawSessionMaterial,
  toggleChatFreeze,
  updateSessionPlan,
  updateWhiteboard,
  updateSessionPrompt,
  setBreakTheme,
  voteForSessionTime,
} from "../controllers/sessionController.js";

const router = express.Router();

router.get("/:groupId/current", protect, getCurrentSession);
router.get("/:groupId/history", protect, getSessionHistory);
router.post("/:groupId/lobby", protect, createLobby);
router.post("/:groupId/plan", protect, updateSessionPlan);
router.post("/:groupId/material/import", protect, importSessionMaterial);
router.post("/:groupId/material/withdraw", protect, withdrawSessionMaterial);
router.post("/:groupId/vote-time", protect, voteForSessionTime);
router.post("/:groupId/finalize-plan", protect, finalizeSessionPlan);
router.post("/:groupId/teacher-ready", protect, markTeacherReady);
router.post("/:groupId/reveal-teacher", protect, revealNextTeacher);
router.post("/:groupId/start", protect, startSession);
router.post("/:groupId/end", protect, endSession);
router.post("/:groupId/advance", protect, advancePhaseManually);
router.post("/:groupId/quiz/submit", protect, submitQuizAnswers);
router.post("/:groupId/chat-freeze", protect, toggleChatFreeze);
router.post("/:groupId/prompt", protect, updateSessionPrompt);
router.post("/:groupId/speak/:userId", protect, approveSpeakRequest);
router.post("/:groupId/whiteboard", protect, updateWhiteboard);
router.post("/:groupId/break-track", protect, addBreakTrack);
router.post("/:groupId/break-media", protect, controlBreakMedia);
router.post("/:groupId/break-theme", protect, setBreakTheme);

export default router;
