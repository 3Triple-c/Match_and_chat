import { create } from "zustand";
import api from "../api/axios";
import { useSocketStore } from "./socketStore";
import storage from "../utils/storage";

export const useAuthStore = create(set => ({
  user: null,
  token: storage.getItem("token"),
  loading: false,
  availabilityLoading: false,
  profileLoading: false,
  error: null,

  login: async credentials => {
    set({
      loading: true,
      error: null,
    });
    try {
      const res = await api.post("/auth/login", credentials);
      storage.setItem("token", res.data.token);
      useSocketStore.getState().connect(res.data.token);
      set({
        token: res.data.token,
        user: res.data.user,
        loading: false,
      });
    } catch (err) {
      set({
        error: err.response?.data?.message || "Login failed",
        loading: false,
      });
    }
  },
  register: async data => {
    set({
      loading: true,
      error: null,
    });
    try {
      const res = await api.post("/auth/register", data);
      storage.setItem("token", res.data.token);
      useSocketStore.getState().connect(res.data.token);

      set({
        token: res.data.token,
        user: res.data.user,
        loading: false,
      });
    } catch (err) {
      set({
        error: err.response?.data?.message || "Register failed",
        loading: false,
      });
    }
  },
  me: async () => {
    try {
      const res = await api.get("/user/me");
      set({ user: res.data });
    } catch {
      storage.removeItem("token");
      set({ token: null, user: null });
    }
  },
  toggleAvailability: async () => {
    set({ availabilityLoading: true, error: null });
    try {
      const res = await api.post("/user/toggleAvailabilty");
      set(state => ({
        user: state.user
          ? { ...state.user, isAvailable: res.data.isAvailable }
          : state.user,
        availabilityLoading: false,
      }));
      return res.data;
    } catch (err) {
      set({
        error: err.response?.data?.message || "Failed to toggle availability",
        availabilityLoading: false,
      });
      throw err;
    }
  },
  updateProfile: async updates => {
    set({ profileLoading: true, error: null });
    try {
      const res = await api.put("/user/update", updates);
      set({ user: res.data, profileLoading: false });
      return res.data;
    } catch (err) {
      set({
        error: err.response?.data?.message || "Failed to update profile",
        profileLoading: false,
      });
      throw err;
    }
  },
  logout: () => {
    storage.removeItem("token");
    useSocketStore.getState().disconnect();
    set({ user: null, token: null });
  },
}));
