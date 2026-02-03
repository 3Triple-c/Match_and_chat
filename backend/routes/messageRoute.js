import express from "express";
import { getGroupMessages } from "../controllers/messageController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

// router.get("/group/:groupId", protect, getGroupMessages);
router.get("/:groupId/messages", protect, getGroupMessages);

export default router;
