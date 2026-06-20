import User from "../models/User.js";
import Group from "../models/Group.js";
import Match from "../models/Match.js";
import { runMatchingAlgorithm } from "./matchController.js";

const escapeRegex = value => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const toBooleanFilter = value => {
  if (value === "true") return true;
  if (value === "false") return false;
  return undefined;
};

export const getAdminOverview = async (req, res) => {
  try {
    const [
      totalUsers,
      onlineUsers,
      availableUsers,
      totalGroups,
      activeGroups,
      totalMatches,
      activeMatches,
      recentUsers,
      recentGroups,
      recentMatches,
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ isOnlineOnApp: true }),
      User.countDocuments({ isAvailable: true }),
      Group.countDocuments(),
      Group.countDocuments({ isActive: true }),
      Match.countDocuments(),
      Match.countDocuments({ isActive: true }),
      User.find()
        .sort({ createdAt: -1 })
        .limit(5)
        .select(
          "name email role primaryInterest isAvailable isOnlineOnApp lastSeenOnAppAt createdAt",
        ),
      Group.find()
        .sort({ createdAt: -1 })
        .limit(5)
        .populate("createBy", "name email")
        .select("name topic members isActive createBy createdAt"),
      Match.find()
        .sort({ createdAt: -1 })
        .limit(5)
        .populate("users.user", "name email")
        .select(
          "name isActive isGroupCreated users expiresAt createdAt groupId",
        ),
    ]);

    res.json({
      metrics: {
        totalUsers,
        onlineUsers,
        availableUsers,
        unavailableUsers: totalUsers - availableUsers,
        totalGroups,
        activeGroups,
        inactiveGroups: totalGroups - activeGroups,
        totalMatches,
        activeMatches,
        inactiveMatches: totalMatches - activeMatches,
      },
      recent: {
        users: recentUsers,
        groups: recentGroups,
        matches: recentMatches,
      },
    });
  } catch (err) {
    console.error("Admin overview error:", err);
    res.status(500).json({ message: "Failed to load admin overview" });
  }
};

export const getAdminUsers = async (req, res) => {
  try {
    const { q = "", availability, role, limit = 50 } = req.query;
    const query = {};

    if (q.trim()) {
      const regex = new RegExp(escapeRegex(q.trim()), "i");
      query.$or = [
        { name: regex },
        { email: regex },
        { primaryInterest: regex },
        { department: regex },
      ];
    }

    const availabilityFilter = toBooleanFilter(availability);
    if (availabilityFilter !== undefined) {
      query.isAvailable = availabilityFilter;
    }

    if (role) {
      query.role = role;
    }

    const users = await User.find(query)
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .select(
        "name email role department level primaryInterest isAvailable isOnlineOnApp lastSeenOnAppAt groups createdAt",
      );

    res.json(users);
  } catch (err) {
    console.error("Admin users error:", err);
    res.status(500).json({ message: "Failed to load users" });
  }
};

export const getAdminGroups = async (req, res) => {
  try {
    const { q = "", active, limit = 50 } = req.query;
    const query = {};

    if (q.trim()) {
      const regex = new RegExp(escapeRegex(q.trim()), "i");
      query.$or = [{ name: regex }, { internalName: regex }, { topic: regex }];
    }

    const activeFilter = toBooleanFilter(active);
    if (activeFilter !== undefined) {
      query.isActive = activeFilter;
    }

    const groups = await Group.find(query)
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .populate("createBy", "name email")
      .populate("members", "name email primaryInterest isAvailable")
      .select(
        "name internalName topic members isActive feedbacks createBy createdAt",
      );

    res.json(groups);
  } catch (err) {
    console.error("Admin groups error:", err);
    res.status(500).json({ message: "Failed to load groups" });
  }
};

export const getAdminMatches = async (req, res) => {
  try {
    const { q = "", status = "all", limit = 50 } = req.query;
    const query = {};

    if (q.trim()) {
      const regex = new RegExp(escapeRegex(q.trim()), "i");
      query.name = regex;
    }

    if (status === "active") query.isActive = true;
    if (status === "inactive") query.isActive = false;
    if (status === "grouped") query.isGroupCreated = true;
    if (status === "ungrouped") query.isGroupCreated = false;

    const matches = await Match.find(query)
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .populate("users.user", "name email primaryInterest isAvailable")
      .populate("groupId", "name isActive")
      .select("name users expiresAt isActive isGroupCreated createdAt groupId");

    res.json(matches);
  } catch (err) {
    console.error("Admin matches error:", err);
    res.status(500).json({ message: "Failed to load matches" });
  }
};

export const globalAdminSearch = async (req, res) => {
  try {
    const { q = "" } = req.query;
    const term = q.trim();

    if (!term) {
      return res.json({ users: [], groups: [], matches: [] });
    }

    const regex = new RegExp(escapeRegex(term), "i");

    const [users, groups, matches] = await Promise.all([
      User.find({
        $or: [
          { name: regex },
          { email: regex },
          { primaryInterest: regex },
          { department: regex },
        ],
      })
        .sort({ createdAt: -1 })
        .limit(10)
        .select(
          "name email role primaryInterest isAvailable isOnlineOnApp lastSeenOnAppAt createdAt",
        ),
      Group.find({
        $or: [{ name: regex }, { internalName: regex }, { topic: regex }],
      })
        .sort({ createdAt: -1 })
        .limit(10)
        .populate("createBy", "name email")
        .select("name topic members isActive createBy createdAt"),
      Match.find({ name: regex })
        .sort({ createdAt: -1 })
        .limit(10)
        .populate("users.user", "name email")
        .populate("groupId", "name")
        .select(
          "name isActive isGroupCreated users expiresAt createdAt groupId",
        ),
    ]);

    res.json({ users, groups, matches });
  } catch (err) {
    console.error("Admin search error:", err);
    res.status(500).json({ message: "Failed to search admin data" });
  }
};

export const runAdminMatching = async (req, res) =>
  runMatchingAlgorithm(req, res);
