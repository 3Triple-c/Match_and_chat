import { create } from "zustand";
import api from "../api/axios";

export const useGroupStore = create(set => ({
  groups: [],
  activeGroup: null,
  loading: false,

  fetchMyGroups: async () => {
    set({
      loading: true,
    });
    const res = await api.get("/group/my");
    set({ groups: res.data, loading: false });
  },

  createGroup: async payload => {
    const res = await api.post("/group", payload);
    set(state => ({ groups: [...state.groups, res.data] }));
  },

  leaveGroup: async groupId => {
    await api.post(`/group/${groupId}/leave`);
    set(state => ({
      groups: state.groups.filter(g => g._id !== groupId),
      activeGroup:
        state.activeGroup?._id === groupId ? null : state.activeGroup,
    }));
  },
  setActiveGroup: group => set({ activeGroup: group }),
}));
