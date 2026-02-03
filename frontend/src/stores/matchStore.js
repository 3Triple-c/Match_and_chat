import { create } from "zustand";
// import axios from "axios";
import { fetchActiveMatch } from "../api/match.api.js";
import api from "../api/axios.js";

// 08033481467
// 08036541427
const useMatchStore = create((set, get) => ({
  activeMatch: null,
  createdGroup: null,
  loading: false,
  error: null,
  isActing: false,

  fetchActiveMatch: async () => {
    set({ loading: true, error: null });
    try {
      const data = await fetchActiveMatch();
      set({
        activeMatch: data,
        createdGroup: null,
        loading: false,
      });
      return data;
    } catch (err) {
      if (err.response?.status === 404) {
        set({ activeMatch: null, loading: false });
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
      set({ activeMatch: res.data.match });
    } finally {
      set({ isActing: false });
    }
  },

  rejectMatch: async matchId => {
    if (get().isActing) return;
    set({ isActing: true });
    try {
      await api.put("/match/reject", { matchId });
      set({ activeMatch: null });
    } finally {
      set({ isActing: false });
    }
  },
}));

export default useMatchStore;
