import express from "express";
import http from "http";
import fs from "fs";
import path from "path";
import authRoute from "./routes/authRoute.js";
import groupRoute from "./routes/groupRoute.js";
import userRoute from "./routes/userRoute.js";
import matchRoute from "./routes/matchRoute.js";
import messageRoute from "./routes/messageRoute.js";
import interestRoute from "./routes/interestRoute.js";
import adminRoute from "./routes/adminRoute.js";
import sessionRoute from "./routes/sessionRoute.js";
import { startMatchCleanup } from "./jobs/matchCleanup.js";
import { autoStartScheduledSessions } from "./controllers/sessionController.js";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import { initSocket } from "./middleware/socket.js";
import { seedInterestsIfEmpty } from "./utils/seedInterests.js";
import { fileURLToPath } from "url";

dotenv.config();

const app = express();
const backendDir = path.dirname(fileURLToPath(import.meta.url));
const frontendDistPath = path.resolve(backendDir, "../frontend/dist");
const frontendIndexPath = path.join(frontendDistPath, "index.html");

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, true);
        return;
      }

      const allowedOrigins = new Set([
        "http://localhost:5173",
        "http://127.0.0.1:5173",
      ]);
      const localNetworkOriginPattern =
        /^https?:\/\/(localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+):5173$/;
      const ngrokOriginPattern = /^https:\/\/[a-z0-9-]+\.ngrok-free\.dev$/i;

      if (
        allowedOrigins.has(origin) ||
        localNetworkOriginPattern.test(origin) ||
        ngrokOriginPattern.test(origin)
      ) {
        callback(null, true);
        return;
      }

      callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  }),
);
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.use("/api/match", matchRoute);
app.use("/api/auth", authRoute);
app.use("/api/group", groupRoute);
app.use("/api/user", userRoute);
app.use("/api/message", messageRoute);
app.use("/api/interests", interestRoute);
app.use("/api/admin", adminRoute);
app.use("/api/session", sessionRoute);

if (fs.existsSync(frontendIndexPath)) {
  app.use(express.static(frontendDistPath));
  app.get(/^\/(?!api|socket\.io).*/, (req, res) => {
    res.sendFile(frontendIndexPath);
  });
}

mongoose
  .connect(process.env.MONGODB_URL, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    mongoose.connection.on("disconnected", () => {
      console.warn("MongoDB disconnected. Retrying...");
    });

    mongoose.connection.on("reconnected", () => {
      console.log("MongoDB reconnected");
      //process.exit(1)
    });

    seedInterestsIfEmpty()
      .catch(err => console.error("Interest seed failed:", err))
      .finally(() => {
        const PORT = process.env.PORT || 5000;
        const server = http.createServer(app);

        initSocket(server);
        setInterval(() => {
          autoStartScheduledSessions().catch(err => {
            console.error("Scheduled session watcher failed:", err);
          });
        }, 60000);
        server.listen(PORT, () => {
          console.log(`backend is running catch it `);
        });
      });
  })
  .catch(err => console.error("Mongodb connection failed:", err));
startMatchCleanup();
