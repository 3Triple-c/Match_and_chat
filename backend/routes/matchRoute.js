import {
  runMatchingAlgorithm,
  rejectMatch,
  acceptMatch,
  // getUserMatches,
  getMyActiveMatches,
} from "../controllers/matchController.js";
import { protect } from "../middleware/authMiddleware.js";
import { requireAdmin } from "../middleware/adminMiddleware.js";
import express from "express";

const router = express.Router();
router.post("/run", protect, requireAdmin, runMatchingAlgorithm);
router.put("/accept", protect, acceptMatch);
router.put("/reject", protect, rejectMatch);
// router.get("/active", protect, getUserMatches);
router.get("/active", protect, getMyActiveMatches);
export default router;
