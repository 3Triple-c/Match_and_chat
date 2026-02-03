import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import {
  leaveGroup,
  getGroupDetails,
  rateGroup,
  deleteGroup,
  getMyGroups,
} from "../controllers/groupController.js";

const router = express.Router();
router.get("/my", protect, getMyGroups);
router.get("/details", protect, getGroupDetails);
router.put("/leave", protect, leaveGroup);
router.post("/rate", protect, rateGroup);
router.delete("/delete", protect, deleteGroup);
export default router;
