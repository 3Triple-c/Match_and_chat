import api from "./axios.js";

export const fetchInterests = async () => {
  const res = await api.get("/interests");
  return res.data;
};
