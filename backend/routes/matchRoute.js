import {
  runMatchingAlgorithm,
  rejectMatch,
  acceptMatch,
  // getUserMatches,
  getMyActiveMatch,
} from "../controllers/matchController.js";
import { protect } from "../middleware/authMiddleware.js";
import express from "express";

const router = express.Router();
router.post("/run", protect, runMatchingAlgorithm);
router.put("/accept", protect, acceptMatch);
router.put("/reject", protect, rejectMatch);
// router.get("/active", protect, getUserMatches);
router.get("/active", protect, getMyActiveMatch);
export default router;
