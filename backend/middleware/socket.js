import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import User from "../models/User.js";
import Group from "../models/Group.js";
import Message from "../models/Message.js";
import { getJwtSecret } from "../utils/jwt.js";
import {
  canUserUseSessionAudio,
  canUserEditWhiteboardNow,
  canUserSendMessage,
  emitSessionState,
  recordBreakActivity,
  markSessionPresence,
  markUserOfflineInAllSessions,
  recordSessionMessage,
  requestToSpeak,
  serializeWhiteboardForClient,
  sessionRoomId,
  syncWhiteboardState,
} from "../controllers/sessionController.js";
let io;
const sessionVoiceRoomId = groupId => `${sessionRoomId(groupId)}:voice`;

export const socketAuth = async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error("No token provided")); // my fronteend sends the token

    const decoded = jwt.verify(token, getJwtSecret());
    const user = await User.findById(decoded.id).select("_id name email");
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
    User.findByIdAndUpdate(socket.user.id, {
      $set: {
        isOnlineOnApp: true,
        lastSeenOnAppAt: new Date(),
      },
    }).catch(err => {
      console.error("online presence update error:", err);
    });
    socket.on("joinGroup", async ({ groupId }) => {
      try {
        console.log("joinGroup called with:", groupId);
        if (!mongoose.Types.ObjectId.isValid(groupId)) {
          socket.emit("socketError", { message: "Invalid group ID" });
          return;
        }

        const group = await Group.findById(groupId);
        if (!group) {
          console.log("group not found");
          socket.emit("socketError", { message: "Group not found" });
          return;
        }
        console.log(
          "Group Members:",
          group.members.map(m => m.toString()),
        );
        console.log("socket user:", socket.user.id);

        if (!group.members.some(m => m.toString() === socket.user.id)) {
          console.log("User is not a member of this group");
          socket.emit("socketError", { message: "Not authorized for group" });
          return;
        }

        socket.join(groupId);
        socket.join(sessionRoomId(groupId));
        await markSessionPresence({
          groupId,
          userId: socket.user.id,
          online: true,
        });
        await emitSessionState(groupId);
        socket.emit("joinedGroup", groupId);
      } catch (err) {
        console.error("joinGroup error:", err);
        socket.emit("socketError", { message: "Failed to join group" });
      }
    });

    socket.on("session:join", async ({ groupId }) => {
      try {
        if (!mongoose.Types.ObjectId.isValid(groupId)) {
          socket.emit("socketError", { message: "Invalid group ID" });
          return;
        }

        socket.join(sessionRoomId(groupId));
        await markSessionPresence({
          groupId,
          userId: socket.user.id,
          online: true,
        });
        await emitSessionState(groupId);
      } catch (err) {
        console.error("session:join error:", err);
        socket.emit("socketError", { message: "Failed to join session room" });
      }
    });

    socket.on("session:requestSpeak", async ({ groupId }) => {
      try {
        if (!mongoose.Types.ObjectId.isValid(groupId)) {
          socket.emit("socketError", { message: "Invalid group ID" });
          return;
        }

        await requestToSpeak({ groupId, userId: socket.user.id });
      } catch (err) {
        console.error("session:requestSpeak error:", err);
        socket.emit("socketError", { message: "Failed to update speak request" });
      }
    });

    socket.on("sendMessage", async ({ groupId, content }) => {
      try {
        if (!content?.trim()) return;
        if (!mongoose.Types.ObjectId.isValid(groupId)) {
          socket.emit("socketError", { message: "Invalid group ID" });
          return;
        }

        const group = await Group.findById(groupId);
        if (!group) {
          socket.emit("socketError", { message: "Group not found" });
          return;
        }
        if (!group.members.some(m => m.toString() === socket.user.id)) {
          socket.emit("socketError", { message: "Not authorized for group" });
          return;
        }
        const permission = await canUserSendMessage({
          groupId,
          userId: socket.user.id,
        });
        if (!permission.allowed) {
          socket.emit("socketError", { message: permission.reason });
          return;
        }
        const message = await Message.create({
          group: groupId,
          sender: socket.user.id,
          content: content.trim(),
        });
        await recordSessionMessage({
          groupId,
          userId: socket.user.id,
          content: message.content,
        });
        io.to(groupId).emit("newMessage", {
          _id: message._id,
          group: groupId,
          sender: {
            _id: socket.user._id,
            email: socket.user.email,
          },
          content: message.content,
          createdAt: message.createdAt,
          updatedAt: message.updatedAt,
        });
      } catch (err) {
        console.error("sendMessage error:", err);
        socket.emit("socketError", { message: "Failed to send message" });
      }
    });
    socket.on("session:whiteboardSync", async payload => {
      try {
        const { groupId, content = "", strokes = [], clear = false } = payload || {};
        if (!mongoose.Types.ObjectId.isValid(groupId)) {
          socket.emit("socketError", { message: "Invalid group ID" });
          return;
        }
        const session = await syncWhiteboardState({
          groupId,
          userId: socket.user.id,
          content,
          strokes,
          clear,
        });
        io.to(sessionRoomId(groupId)).emit("session:whiteboardState", {
          groupId,
          whiteboard: serializeWhiteboardForClient(session),
        });
      } catch (err) {
        console.error("session:whiteboardSync error:", err);
        socket.emit("socketError", {
          message: err.message || "Failed to sync whiteboard",
        });
      }
    });
    socket.on("session:whiteboardStrokeLive", async payload => {
      try {
        const {
          groupId,
          strokeId,
          color = "#263238",
          point,
          finished = false,
        } = payload || {};
        if (!mongoose.Types.ObjectId.isValid(groupId)) {
          socket.emit("socketError", { message: "Invalid group ID" });
          return;
        }
        if (!strokeId) {
          socket.emit("socketError", { message: "Missing whiteboard stroke ID" });
          return;
        }

        const access = await canUserEditWhiteboardNow({
          groupId,
          userId: socket.user.id,
        });
        if (!access.allowed) {
          socket.emit("socketError", {
            message: access.reason || "Whiteboard editing is locked right now",
          });
          return;
        }

        socket.to(sessionRoomId(groupId)).emit("session:whiteboardStrokeLive", {
          groupId,
          strokeId,
          color,
          point,
          finished,
          user: {
            _id: socket.user._id,
            name: socket.user.name,
            email: socket.user.email,
          },
        });
      } catch (err) {
        console.error("session:whiteboardStrokeLive error:", err);
        socket.emit("socketError", {
          message: "Failed to sync whiteboard stroke",
        });
      }
    });
    socket.on("session:voice:join", async ({ groupId }) => {
      try {
        if (!mongoose.Types.ObjectId.isValid(groupId)) {
          socket.emit("socketError", { message: "Invalid group ID" });
          return;
        }

        const group = await Group.findById(groupId).select("members");
        if (!group || !group.members.some(m => m.toString() === socket.user.id)) {
          socket.emit("socketError", { message: "Not authorized for group audio" });
          return;
        }

        const audioAccess = await canUserUseSessionAudio({
          groupId,
          userId: socket.user.id,
        });
        if (!audioAccess.allowed) {
          socket.emit("socketError", {
            message: audioAccess.reason || "Audio is locked in this phase",
          });
          return;
        }

        const voiceRoom = sessionVoiceRoomId(groupId);
        const existingSocketIds = [...(io.sockets.adapter.rooms.get(voiceRoom) || [])];
        const peers = existingSocketIds
          .map(socketId => {
            const peerSocket = io.sockets.sockets.get(socketId);
            if (!peerSocket?.user) return null;
            return {
              socketId,
              user: {
                _id: peerSocket.user._id,
                name: peerSocket.user.name,
                email: peerSocket.user.email,
              },
            };
          })
          .filter(Boolean);

        socket.join(voiceRoom);
        socket.emit("session:voice:joined", {
          groupId,
          peersCount: peers.length,
          voiceRoom,
        });
        socket.emit("session:voice:peers", { groupId, peers });
        socket.to(voiceRoom).emit("session:voice:user-joined", {
          groupId,
          socketId: socket.id,
          user: {
            _id: socket.user._id,
            name: socket.user.name,
            email: socket.user.email,
          },
        });
        await recordBreakActivity({
          groupId,
          type: "presence",
          label: `${socket.user.name || socket.user.email || "A member"} joined the room`,
          detail: "The room stays active while break is live.",
          createdBy: socket.user._id,
        });
        await emitSessionState(groupId);
      } catch (err) {
        console.error("session:voice:join error:", err);
        socket.emit("socketError", { message: "Failed to join voice room" });
      }
    });
    socket.on("session:voice:leave", async ({ groupId }) => {
      try {
        if (!mongoose.Types.ObjectId.isValid(groupId)) {
          return;
        }
        const voiceRoom = sessionVoiceRoomId(groupId);
        socket.leave(voiceRoom);
        socket.to(voiceRoom).emit("session:voice:user-left", {
          groupId,
          socketId: socket.id,
          userId: socket.user._id,
        });
        await recordBreakActivity({
          groupId,
          type: "presence",
          label: `${socket.user.name || socket.user.email || "A member"} left the room`,
          detail: "The break room updated its presence list.",
          createdBy: socket.user._id,
        });
        await emitSessionState(groupId);
      } catch (err) {
        console.error("session:voice:leave error:", err);
      }
    });
    socket.on("session:voice:offer", ({ targetSocketId, groupId, offer }) => {
      io.to(targetSocketId).emit("session:voice:offer", {
        groupId,
        sourceSocketId: socket.id,
        sourceUser: {
          _id: socket.user._id,
          name: socket.user.name,
          email: socket.user.email,
        },
        offer,
      });
    });
    socket.on("session:voice:answer", ({ targetSocketId, groupId, answer }) => {
      io.to(targetSocketId).emit("session:voice:answer", {
        groupId,
        sourceSocketId: socket.id,
        sourceUser: {
          _id: socket.user._id,
          name: socket.user.name,
          email: socket.user.email,
        },
        answer,
      });
    });
    socket.on("session:voice:ice-candidate", ({ targetSocketId, groupId, candidate }) => {
      io.to(targetSocketId).emit("session:voice:ice-candidate", {
        groupId,
        sourceSocketId: socket.id,
        sourceUser: {
          _id: socket.user._id,
          name: socket.user.name,
          email: socket.user.email,
        },
        candidate,
      });
    });
    socket.on("session:break:react", async ({ groupId, emoji }) => {
      try {
        if (!mongoose.Types.ObjectId.isValid(groupId) || !emoji) return;
        const createdAt = new Date().toISOString();
        const user = {
          _id: socket.user._id,
          name: socket.user.name,
          email: socket.user.email,
        };
        await recordBreakActivity({
          groupId,
          type: "reaction",
          label: `${emoji} reaction`,
          detail: `${socket.user.name || socket.user.email || "A member"} reacted with ${emoji}.`,
          createdBy: socket.user._id,
        });
        io.to(sessionRoomId(groupId)).emit("session:break:reaction", {
          groupId,
          emoji,
          createdAt,
          user,
        });
        await emitSessionState(groupId);
      } catch (err) {
        console.error("session:break:react error:", err);
        socket.emit("socketError", { message: "Failed to send break reaction" });
      }
    });
    socket.on("disconnect", () => {
      console.log("Socket disconnected:", socket.id);
      socket.rooms.forEach(room => {
        if (!room.endsWith(":voice")) return;
        socket.to(room).emit("session:voice:user-left", {
          socketId: socket.id,
          userId: socket.user._id,
        });
      });
      markUserOfflineInAllSessions(socket.user.id).catch(err => {
        console.error("disconnect presence cleanup error:", err);
      });
      User.findByIdAndUpdate(socket.user.id, {
        $set: {
          isOnlineOnApp: false,
          lastSeenOnAppAt: new Date(),
        },
      }).catch(err => {
        console.error("offline presence update error:", err);
      });
    });
  });
};

export const getIO = () => io;
