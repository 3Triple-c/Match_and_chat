import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import Group from "../models/Group.js";
import Message from "../models/Message.js";
let io;

export const socketAuth = async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error("No token provided")); // my fronteend sends the token

    const decoded = jwt.verify(token, process.env.JWT_SECRETT);
    const user = await User.findById(decoded.id).select("_id email");
    if (!user) return next(new Error(" User note found"));
    socket.user = user;
    next();
  } catch (err) {
    console.error("Socket auth error:", err.message);
    next(new Error("Authentication failed"));
  }
};

export const initSocket = server => {
  io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  // console.log("INIT SOCKET CALLED");
  io.use(socketAuth);
  io.on("connection", socket => {
    console.log("Socket connected:", socket.user.id);
    socket.join(socket.user.id.toString());
    socket.on("joinGroup", async ({ groupId }) => {
      // if (!groupId) return;
      console.log("joinGroup called with:", groupId);

      const group = await Group.findById(groupId);
      if (!group) {
        console.log("group not found");

        return;
      }
      console.log(
        "Group Members:",
        group.members.map(m => m.toString()),
      );
      console.log("socket user:", socket.user.id);

      if (!group.members.some(m => m.toString() === socket.user.id)) {
        console.log("User is not a member of this group");

        return;
      }

      socket.join(groupId);
      socket.emit("joinedGroup", groupId);
    });

    socket.on("sendMessage", async ({ groupId, content }) => {
      if (!content?.trim()) return;
      const group = await Group.findById(groupId);
      if (!group) return;
      if (!group.members.some(m => m.toString() === socket.user.id)) return;
      const message = await Message.create({
        group: groupId,
        sender: socket.user.id,
        content,
      });
      io.to(groupId).emit("newMessage", {
        _id: message._id,
        group: groupId,
        sender: socket.user.id,
        content,
        createdAt: message.createdAt,
      });
    });
    socket.on("disconnect", () => {
      console.log("Socket disconnected:", socket.id);
    });
  });
};

export const getIO = () => io;
