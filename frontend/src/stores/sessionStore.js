import { create } from "zustand";
import api from "../api/axios";

export const useSessionStore = create(set => ({
  currentSession: null,
  sessionHistory: [],
  loading: false,
  actionLoading: false,
  quizSubmitting: false,
  error: null,

  fetchCurrentSession: async groupId => {
    if (!groupId) {
      set({ currentSession: null });
      return null;
    }

    set({ loading: true, error: null });
    try {
      const res = await api.get(`/session/${groupId}/current`);
      set({ currentSession: res.data, loading: false });
      return res.data;
    } catch (err) {
      set({
        loading: false,
        error: err.response?.data?.message || "Failed to load session",
      });
    }
  },

  fetchSessionHistory: async groupId => {
    if (!groupId) {
      set({ sessionHistory: [] });
      return [];
    }

    try {
      const res = await api.get(`/session/${groupId}/history`);
      set({ sessionHistory: res.data || [] });
      return res.data;
    } catch (err) {
      set({
        error: err.response?.data?.message || "Failed to load session history",
      });
      return [];
    }
  },

  createLobby: async groupId => {
    set({ actionLoading: true, error: null });
    try {
      const res = await api.post(`/session/${groupId}/lobby`);
      set({ currentSession: res.data, actionLoading: false });
      return res.data;
    } catch (err) {
      set({
        actionLoading: false,
        error: err.response?.data?.message || "Failed to create lobby",
      });
      throw err;
    }
  },

  updatePlan: async (groupId, payload) => {
    set({ actionLoading: true, error: null });
    try {
      const res = await api.post(`/session/${groupId}/plan`, payload);
      set({ currentSession: res.data, actionLoading: false });
      return res.data;
    } catch (err) {
      set({
        actionLoading: false,
        error: err.response?.data?.message || "Failed to update session plan",
      });
      throw err;
    }
  },

  finalizePlan: async groupId => {
    set({ actionLoading: true, error: null });
    try {
      const res = await api.post(`/session/${groupId}/finalize-plan`);
      set({ currentSession: res.data, actionLoading: false });
      return res.data;
    } catch (err) {
      set({
        actionLoading: false,
        error: err.response?.data?.message || "Failed to finalize next session plan",
      });
      throw err;
    }
  },

  importMaterial: async (groupId, payload) => {
    set({ actionLoading: true, error: null });
    try {
      const res = await api.post(`/session/${groupId}/material/import`, payload);
      set({ currentSession: res.data, actionLoading: false });
      return res.data;
    } catch (err) {
      set({
        actionLoading: false,
        error: err.response?.data?.message || "Failed to import session material",
      });
      throw err;
    }
  },

  withdrawMaterial: async groupId => {
    set({ actionLoading: true, error: null });
    try {
      const res = await api.post(`/session/${groupId}/material/withdraw`);
      set({ currentSession: res.data, actionLoading: false });
      return res.data;
    } catch (err) {
      set({
        actionLoading: false,
        error: err.response?.data?.message || "Failed to withdraw session material",
      });
      throw err;
    }
  },

  voteTimeOption: async (groupId, value) => {
    set({ actionLoading: true, error: null });
    try {
      const res = await api.post(`/session/${groupId}/vote-time`, { value });
      set({ currentSession: res.data, actionLoading: false });
      return res.data;
    } catch (err) {
      set({
        actionLoading: false,
        error: err.response?.data?.message || "Failed to vote for session time",
      });
      throw err;
    }
  },

  startSession: async groupId => {
    set({ actionLoading: true, error: null });
    try {
      const res = await api.post(`/session/${groupId}/start`);
      set({ currentSession: res.data, actionLoading: false });
      return res.data;
    } catch (err) {
      set({
        actionLoading: false,
        error: err.response?.data?.message || "Failed to start session",
      });
      throw err;
    }
  },

  endSession: async groupId => {
    set({ actionLoading: true, error: null });
    try {
      const res = await api.post(`/session/${groupId}/end`);
      const historyRes = await api.get(`/session/${groupId}/history`);
      set({
        currentSession: res.data,
        sessionHistory: historyRes.data || [],
        actionLoading: false,
      });
      return res.data;
    } catch (err) {
      set({
        actionLoading: false,
        error: err.response?.data?.message || "Failed to end session",
      });
      throw err;
    }
  },

  advancePhase: async groupId => {
    set({ actionLoading: true, error: null });
    try {
      const res = await api.post(`/session/${groupId}/advance`);
      set({ currentSession: res.data, actionLoading: false });
      return res.data;
    } catch (err) {
      set({
        actionLoading: false,
        error: err.response?.data?.message || "Failed to advance session",
      });
      throw err;
    }
  },

  submitQuizAnswers: async (groupId, answers) => {
    set({ quizSubmitting: true, error: null });
    try {
      const res = await api.post(`/session/${groupId}/quiz/submit`, { answers });
      set({ currentSession: res.data, quizSubmitting: false });
      return res.data;
    } catch (err) {
      set({
        quizSubmitting: false,
        error: err.response?.data?.message || "Failed to submit quiz",
      });
      throw err;
    }
  },

  toggleChatFreeze: async groupId => {
    set({ actionLoading: true, error: null });
    try {
      const res = await api.post(`/session/${groupId}/chat-freeze`);
      set({ currentSession: res.data, actionLoading: false });
      return res.data;
    } catch (err) {
      set({
        actionLoading: false,
        error: err.response?.data?.message || "Failed to toggle chat freeze",
      });
      throw err;
    }
  },

  updatePrompt: async (groupId, prompt) => {
    set({ actionLoading: true, error: null });
    try {
      const res = await api.post(`/session/${groupId}/prompt`, { prompt });
      set({ currentSession: res.data, actionLoading: false });
      return res.data;
    } catch (err) {
      set({
        actionLoading: false,
        error: err.response?.data?.message || "Failed to update prompt",
      });
      throw err;
    }
  },

  approveSpeaker: async (groupId, userId, action = "approve") => {
    set({ actionLoading: true, error: null });
    try {
      const res = await api.post(`/session/${groupId}/speak/${userId}`, { action });
      set({ currentSession: res.data, actionLoading: false });
      return res.data;
    } catch (err) {
      set({
        actionLoading: false,
        error: err.response?.data?.message || "Failed to update speaking permission",
      });
      throw err;
    }
  },

  updateWhiteboard: async (groupId, content) => {
    set({ actionLoading: true, error: null });
    try {
      const res = await api.post(`/session/${groupId}/whiteboard`, { content });
      set({ currentSession: res.data, actionLoading: false });
      return res.data;
    } catch (err) {
      set({
        actionLoading: false,
        error: err.response?.data?.message || "Failed to update whiteboard",
      });
      throw err;
    }
  },

  addBreakTrack: async (groupId, payload) => {
    set({ actionLoading: true, error: null });
    try {
      const res = await api.post(`/session/${groupId}/break-track`, payload);
      set({ currentSession: res.data, actionLoading: false });
      return res.data;
    } catch (err) {
      set({
        actionLoading: false,
        error: err.response?.data?.message || "Failed to add break track",
      });
      throw err;
    }
  },

  setBreakTheme: async (groupId, theme) => {
    set({ actionLoading: true, error: null });
    try {
      const res = await api.post(`/session/${groupId}/break-theme`, { theme });
      set({ currentSession: res.data, actionLoading: false });
      return res.data;
    } catch (err) {
      set({
        actionLoading: false,
        error: err.response?.data?.message || "Failed to update break theme",
      });
      throw err;
    }
  },

  controlBreakMedia: async (groupId, action) => {
    set({ actionLoading: true, error: null });
    try {
      const res = await api.post(`/session/${groupId}/break-media`, { action });
      set({ currentSession: res.data, actionLoading: false });
      return res.data;
    } catch (err) {
      set({
        actionLoading: false,
        error: err.response?.data?.message || "Failed to control break media",
      });
      throw err;
    }
  },

  markTeacherReady: async groupId => {
    set({ actionLoading: true, error: null });
    try {
      const res = await api.post(`/session/${groupId}/teacher-ready`);
      set({ currentSession: res.data, actionLoading: false });
      return res.data;
    } catch (err) {
      set({
        actionLoading: false,
        error: err.response?.data?.message || "Failed to mark the teacher as ready",
      });
      throw err;
    }
  },

  revealTeacher: async groupId => {
    set({ actionLoading: true, error: null });
    try {
      const res = await api.post(`/session/${groupId}/reveal-teacher`);
      set({ currentSession: res.data, actionLoading: false });
      return res.data;
    } catch (err) {
      set({
        actionLoading: false,
        error: err.response?.data?.message || "Failed to reveal the next teacher",
      });
      throw err;
    }
  },

  setCurrentSession: session => set({ currentSession: session }),
}));
