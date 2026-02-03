import express from "express";
import http from "http";
import authRoute from "./routes/authRoute.js";
import groupRoute from "./routes/groupRoute.js";
import userRoute from "./routes/userRoute.js";
import matchRoute from "./routes/matchRoute.js";
import messageRoute from "./routes/messageRoute.js";
import { startMatchCleanup } from "./jobs/matchCleanup.js";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import { initSocket } from "./middleware/socket.js";

dotenv.config();

const app = express();

app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  }),
);
app.use(express.json());
app.use("/api/match", matchRoute);
app.use("/api/auth", authRoute);
app.use("/api/group", groupRoute);
app.use("/api/user", userRoute);
app.use("/api/message", messageRoute);

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

    const PORT = process.env.PORT || 5000;
    const server = http.createServer(app);

    initSocket(server);
    server.listen(PORT, () => {
      console.log(`backend is running catch it `);
    });
  })
  .catch(err => console.error("Mongodb connection failed:", err));
startMatchCleanup();
