import express from "express";
import {
  updateProfile,
  getUserProfile,
  toggleAvailability,
} from "../controllers/userController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();
router.put("/update", protect, updateProfile);
router.get("/me", protect, getUserProfile);
router.post("/toggleAvailabilty", protect, toggleAvailability);
export default router;
