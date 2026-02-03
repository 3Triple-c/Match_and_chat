import { create } from "zustand";
import { connectSocket, disconnectSocket } from "../socket/socket";

export const useSocketStore = create(set => ({
  socket: null,
  connected: false,

  connect: token => {
    const socket = connectSocket(token);
    socket.on("connect", () => {
      set({ connected: true });
    });
    socket.on("disconnect", () => {
      set({ connected: false });
    });
    set({ socket });
  },
  disconnect: () => {
    disconnectSocket();
    set({ socket: null, connected: false });
  },
}));
