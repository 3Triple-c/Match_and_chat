import api from "./axios.js";

// fetching currently active match requeset for logged in User

export const fetchActiveMatches = async () => {
  const res = await api.get("/match/active");
  return res.data;
};

// decisioon = accept || reject  (match)

export const respondToMatch = async (matchId, decision) => {
  const res = await api.put(`/match/${decision}`, { matchId });
  return res.data;
};
