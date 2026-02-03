import { io } from "socket.io-client";

const socket = io("http://localhost:5000", {
  auth: {
    token:
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY4YWI1NmFlYjkyNGU1ZjczM2Y5YjBiZCIsImlhdCI6MTc2NzYwODc0NywiZXhwIjoxNzY4MjEzNTQ3fQ.mr4fJK6VPeA4HFB5-mNHi2Ol3p1OtUhJtQ7_5jhCA4c",
  },
  transports: ["polling"],
});

const GROUP_ID = "6947f1479b499012be6502f3";

socket.on("connect", () => {
  console.log("Connected:", socket.id);

  socket.emit("joinGroup", { groupId: GROUP_ID });
});

socket.on("joinedGroup", groupId => {
  console.log("Joined group:", groupId);

  socket.emit("sendMessage", {
    groupId,
    content: "hello gorup",
  });
});

socket.on("newMessage", message => {
  console.log("New message:", message);
});

socket.on("disconnect", () => {
  console.log("Disconnected from server");
});

socket.on("connect_error", err => {
  console.error("Connection Error:", err.message);
});
