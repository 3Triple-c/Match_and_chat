import { create } from "zustand";
import api from "../api/axios";

export const useGroupStore = create(set => ({
  groups: [],
  activeGroup: null,
  loading: false,
  error: null,

  fetchMyGroups: async () => {
    set({
      loading: true,
    });
    const res = await api.get("/group/my");
    set({ groups: res.data, loading: false });
    return res.data;
  },

  fetchGroupDetails: async groupId => {
    set({ loading: true, error: null });
    try {
      const res = await api.get("/group/details", { params: { groupId } });
      set({ activeGroup: res.data, loading: false });
      return res.data;
    } catch (err) {
      set({
        error: err.response?.data?.message || "Failed to load group",
        loading: false,
      });
    }
  },

  leaveGroup: async groupId => {
    await api.put(`/group/leave`, { groupId });
    set(state => ({
      groups: state.groups.filter(g => g._id !== groupId),
      activeGroup:
        state.activeGroup?._id === groupId ? null : state.activeGroup,
    }));
  },
  renameGroup: async (groupId, name) => {
    const res = await api.put("/group/name", { groupId, name });
    set(state => ({
      groups: state.groups.map(g =>
        g._id === groupId ? { ...g, name: res.data.name } : g,
      ),
      activeGroup:
        state.activeGroup?._id === groupId ? res.data : state.activeGroup,
    }));
  },
  updateSessionSettings: async (groupId, payload) => {
    const res = await api.put("/group/session-settings", { groupId, ...payload });
    set(state => ({
      groups: state.groups.map(g => (g._id === groupId ? res.data : g)),
      activeGroup: state.activeGroup?._id === groupId ? res.data : state.activeGroup,
    }));
    return res.data;
  },
  updateNextSessionPlan: async (groupId, payload) => {
    const res = await api.put("/group/next-session", { groupId, ...payload });
    set(state => ({
      groups: state.groups.map(g => (g._id === groupId ? res.data : g)),
      activeGroup: state.activeGroup?._id === groupId ? res.data : state.activeGroup,
    }));
    return res.data;
  },
  clearNextSessionPlan: async groupId => {
    const res = await api.put("/group/clear-next-session", { groupId });
    set(state => ({
      groups: state.groups.map(g => (g._id === groupId ? res.data : g)),
      activeGroup: state.activeGroup?._id === groupId ? res.data : state.activeGroup,
    }));
    return res.data;
  },
  voteNextSessionTime: async (groupId, value) => {
    const res = await api.post("/group/next-session/vote", {
      groupId,
      value,
      confirm: true,
    });
    set(state => ({
      groups: state.groups.map(g => (g._id === groupId ? res.data : g)),
      activeGroup: state.activeGroup?._id === groupId ? res.data : state.activeGroup,
    }));
    return res.data;
  },
  finalizeNextSessionPlan: async groupId => {
    const res = await api.post("/group/next-session/finalize", { groupId });
    set(state => ({
      groups: state.groups.map(g => (g._id === groupId ? res.data : g)),
      activeGroup: state.activeGroup?._id === groupId ? res.data : state.activeGroup,
    }));
    return res.data;
  },
  deleteGroup: async groupId => {
    await api.delete("/group/delete", { data: { groupId } });
    set(state => ({
      groups: state.groups.filter(group => group._id !== groupId),
      activeGroup: state.activeGroup?._id === groupId ? null : state.activeGroup,
    }));
  },
  setActiveGroup: group => set({ activeGroup: group }),
}));
