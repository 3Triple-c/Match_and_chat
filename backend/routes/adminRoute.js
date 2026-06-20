import express from "express";
import {
  getAdminGroups,
  getAdminMatches,
  getAdminOverview,
  getAdminUsers,
  globalAdminSearch,
  runAdminMatching,
} from "../controllers/adminController.js";
import { protect } from "../middleware/authMiddleware.js";
import { requireAdmin } from "../middleware/adminMiddleware.js";

const router = express.Router();

router.use(protect, requireAdmin);
router.get("/overview", getAdminOverview);
router.get("/users", getAdminUsers);
router.get("/groups", getAdminGroups);
router.get("/matches", getAdminMatches);
router.get("/search", globalAdminSearch);
router.post("/matching/run", runAdminMatching);

export default router;
