import { io } from "socket.io-client";
import useMatchStore from "../stores/matchStore";
import { useGroupStore } from "../stores/groupStore";
let socket = null;
const runtimeSocketUrl = import.meta.env.VITE_SOCKET_URL || undefined;
export const connectSocket = token => {
  if (socket) {
    if (!socket.connected) {
      socket.connect();
    }
    return socket;
  }

  socket = io(runtimeSocketUrl, {
    auth: { token },
    transports: ["websocket", "polling"],
    reconnection: true,
  });

  socket.on("match:failed", ({ reason }) => {
    console.log(reason);
    useMatchStore.getState().fetchActiveMatches();
  });

  socket.on("match:created", () => {
    useMatchStore.getState().fetchActiveMatches();
  });

  socket.on("group:created", () => {
    useMatchStore.getState().fetchActiveMatches();
    useGroupStore.getState().fetchMyGroups();
  });

  return socket;
};
export const getSocket = () => socket;
export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};
