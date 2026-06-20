import { create } from "zustand";
import { fetchActiveMatches } from "../api/match.api.js";
import api from "../api/axios.js";
import { useGroupStore } from "./groupStore.js";

// 08033481467
// 08036541427
const useMatchStore = create((set, get) => ({
  activeMatches: [],
  createdGroup: null,
  loading: false,
  error: null,
  isActing: false,

  fetchActiveMatches: async () => {
    set({ loading: true, error: null });
    try {
      const data = await fetchActiveMatches();
      set({
        activeMatches: Array.isArray(data) ? data : [],
        loading: false,
        error: null,
      });
      return data;
    } catch (err) {
      if (err.response?.status === 404) {
        set({ activeMatches: [], loading: false, error: null });
      } else {
        set({
          error: err.response?.data?.message || "Failed to fetch match",
          loading: false,
        });
      }
    }
  },

  acceptMatch: async matchId => {
    if (get().isActing) return;
    set({ isActing: true });
    try {
      const res = await api.put("/match/accept", { matchId });
      await get().fetchActiveMatches();
      if (res.data.group?._id) {
        await useGroupStore.getState().fetchMyGroups();
        set({ createdGroup: res.data.group });
      }
      return res.data;
    } catch (err) {
      set({
        error: err.response?.data?.message || "Failed to accept match",
      });
      throw err;
    } finally {
      set({ isActing: false });
    }
  },

  rejectMatch: async matchId => {
    if (get().isActing) return;
    set({ isActing: true });
    try {
      const res = await api.put("/match/reject", { matchId });
      await get().fetchActiveMatches();
      return res.data;
    } catch (err) {
      set({
        error: err.response?.data?.message || "Failed to reject match",
      });
      throw err;
    } finally {
      set({ isActing: false });
    }
  },

  clearCreatedGroup: () => set({ createdGroup: null }),
}));

export default useMatchStore;
