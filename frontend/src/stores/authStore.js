import { create } from "zustand";
import api from "../api/axios";
import { useSocketStore } from "./socketStore";

export const useAuthStore = create(set => ({
  user: null,
  token: localStorage.getItem("token"),
  loading: false,
  error: null,

  login: async credentials => {
    set({
      loading: true,
      error: null,
    });
    try {
      const res = await api.post("/auth/login", credentials);
      localStorage.setItem("token", res.data.token);
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
      localStorage.setItem("token", res.data.token);
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
      localStorage.removeItem("token");
      set({ token: null, user: null });
    }
  },
  logout: () => {
    localStorage.removeItem("token");
    useSocketStore.getState().disconnect();
    set({ user: null, token: null });
  },
}));
