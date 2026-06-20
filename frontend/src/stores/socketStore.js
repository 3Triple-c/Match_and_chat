import { create } from "zustand";
import { connectSocket, disconnectSocket } from "../socket/socket";

export const useSocketStore = create(set => ({
  socket: null,
  connected: false,

  connect: token => {
    const socket = connectSocket(token);
    socket.off("connect");
    socket.on("connect", () => {
      set({ connected: true });
    });
    socket.off("disconnect");
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
