import axios from "axios";
import storage from "../utils/storage";

const runtimeHost = import.meta.env.VITE_API_URL || "/api";

const api = axios.create({
  baseURL: runtimeHost,
  withCredentials: true,
});
api.interceptors.request.use(config => {
  const token = storage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      storage.removeItem("token");
      window.location.href = "/login?expired=true";
    }
    return Promise.reject(err);
  },
);
export default api;
