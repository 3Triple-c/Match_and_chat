import { io } from "socket.io-client";
import useMatchStore from "../stores/matchStore";
let socket = null;
export const connectSocket = token => {
  if (socket) return socket;

  socket = io("http://localhost:5000", {
    auth: { token },
    transports: ["polling"],
  });

  socket.on("match:failed", ({ matchId, reason }) => {
    console.log(reason);
    useMatchStore.getState().clearActiveMatch();
  });

  socket.on("match:created", () => {
    useMatchStore.getState().fetchActiveMatch();
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
