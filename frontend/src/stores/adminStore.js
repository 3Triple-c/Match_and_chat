import { create } from "zustand";
import api from "../api/axios.js";

const useAdminStore = create((set, get) => ({
  overview: null,
  users: [],
  groups: [],
  matches: [],
  searchResults: { users: [], groups: [], matches: [] },
  loadingOverview: false,
  loadingUsers: false,
  loadingGroups: false,
  loadingMatches: false,
  loadingSearch: false,
  runningMatch: false,
  error: null,
  lastRunResult: null,

  fetchOverview: async () => {
    set({ loadingOverview: true, error: null });
    try {
      const res = await api.get("/admin/overview");
      set({ overview: res.data, loadingOverview: false });
      return res.data;
    } catch (err) {
      set({
        loadingOverview: false,
        error: err.response?.data?.message || "Failed to load admin overview",
      });
    }
  },

  fetchUsers: async params => {
    set({ loadingUsers: true, error: null });
    try {
      const res = await api.get("/admin/users", { params });
      set({ users: res.data, loadingUsers: false });
      return res.data;
    } catch (err) {
      set({
        loadingUsers: false,
        error: err.response?.data?.message || "Failed to load users",
      });
    }
  },

  fetchGroups: async params => {
    set({ loadingGroups: true, error: null });
    try {
      const res = await api.get("/admin/groups", { params });
      set({ groups: res.data, loadingGroups: false });
      return res.data;
    } catch (err) {
      set({
        loadingGroups: false,
        error: err.response?.data?.message || "Failed to load groups",
      });
    }
  },

  fetchMatches: async params => {
    set({ loadingMatches: true, error: null });
    try {
      const res = await api.get("/admin/matches", { params });
      set({ matches: res.data, loadingMatches: false });
      return res.data;
    } catch (err) {
      set({
        loadingMatches: false,
        error: err.response?.data?.message || "Failed to load matches",
      });
    }
  },

  searchAll: async q => {
    set({ loadingSearch: true, error: null });
    try {
      const res = await api.get("/admin/search", { params: { q } });
      set({ searchResults: res.data, loadingSearch: false });
      return res.data;
    } catch (err) {
      set({
        loadingSearch: false,
        error: err.response?.data?.message || "Failed to search admin data",
      });
    }
  },

  runMatching: async () => {
    set({ runningMatch: true, error: null, lastRunResult: null });
    try {
      const res = await api.post("/admin/matching/run");
      set({ runningMatch: false, lastRunResult: res.data });
      await Promise.all([
        get().fetchOverview(),
        get().fetchMatches({ status: "all" }),
        get().fetchGroups({ active: "true" }),
      ]);
      return res.data;
    } catch (err) {
      set({
        runningMatch: false,
        error: err.response?.data?.message || "Failed to run matching",
      });
      throw err;
    }
  },
}));

export default useAdminStore;
