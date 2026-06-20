import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import {
  leaveGroup,
  getGroupDetails,
  rateGroup,
  deleteGroup,
  getMyGroups,
  updateGroupName,
  updateGroupSessionSettings,
  clearNextSessionPlan,
  updateNextSessionPlan,
  voteNextSessionTime,
  finalizeNextSessionPlan,
} from "../controllers/groupController.js";

const router = express.Router();
router.get("/my", protect, getMyGroups);
router.get("/details", protect, getGroupDetails);
router.put("/leave", protect, leaveGroup);
router.put("/name", protect, updateGroupName);
router.put("/session-settings", protect, updateGroupSessionSettings);
router.put("/clear-next-session", protect, clearNextSessionPlan);
router.put("/next-session", protect, updateNextSessionPlan);
router.post("/next-session/vote", protect, voteNextSessionTime);
router.post("/next-session/finalize", protect, finalizeNextSessionPlan);
router.post("/rate", protect, rateGroup);
router.delete("/delete", protect, deleteGroup);
export default router;
