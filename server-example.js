import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";

const app = express();
app.use(
   cors({
      origin: "*",
      methods: ["GET", "POST", "OPTIONS"],
      credentials: true,
   })
);

const server = http.createServer(app);
const io = new Server(server, {
   cors: {
      origin: "*",
      methods: ["GET", "POST", "OPTIONS"],
      credentials: true,
      allowedHeaders: ["*"],
   },
   transports: ["websocket", "polling"],
});

app.get("/", (req, res) => {
   res.json({
      status: "ok",
      message: "WebSocket server is running",
      connections: io.engine?.clientsCount || 0,
   });
});

app.get("/health", (req, res) => {
   res.json({ status: "healthy" });
});

const rooms = new Map();

io.on("connection", (socket) => {
   socket.on("join-room", ({ roomId, user, streamUrl }) => {
      socket.join(roomId);

      if (!rooms.has(roomId)) {
         rooms.set(roomId, {
            users: [],
            streamUrl: null,
         });
      }

      const room = rooms.get(roomId);

      if (streamUrl) {
         if (!room.streamUrl) {
            room.streamUrl = streamUrl;
         }
      }

      const existingUserIndex = room.users.findIndex((u) => u.id === socket.id);

      if (existingUserIndex !== -1) {
         room.users[existingUserIndex] = {
            id: socket.id,
            name: user.name,
         };
      } else {
         const userData = {
            id: socket.id,
            name: user.name,
         };
         room.users.push(userData);
      }

      io.to(roomId).emit("users-update", room.users);

      if (room.streamUrl) {
         socket.emit("stream-url-update", room.streamUrl);
      } else if (streamUrl) {
         room.streamUrl = streamUrl;
         socket.emit("stream-url-update", streamUrl);
      }

      setTimeout(() => {
         if (room.streamUrl) {
            const clientsInRoom = io.sockets.adapter.rooms.get(roomId);
            const clientCount = clientsInRoom ? clientsInRoom.size : 0;
            if (clientCount > 1) {
               socket.to(roomId).emit("stream-url-update", room.streamUrl);
            }
         }
      }, 200);
   });

   socket.on("leave-room", ({ roomId }) => {
      socket.leave(roomId);

      if (rooms.has(roomId)) {
         const room = rooms.get(roomId);
         room.users = room.users.filter((u) => u.id !== socket.id);

         if (room.users.length === 0) {
            rooms.delete(roomId);
         } else {
            io.to(roomId).emit("users-update", room.users);
         }
      }
   });

   socket.on("request-stream-url", ({ roomId }) => {
      if (rooms.has(roomId)) {
         const room = rooms.get(roomId);
         if (room.streamUrl) {
            socket.emit("stream-url-update", room.streamUrl);
            io.to(roomId).emit("stream-url-update", room.streamUrl);
         }
      }
   });

   socket.on("control-command", ({ roomId, command, data }) => {
      if (rooms.has(roomId)) {
         socket.to(roomId).emit("control-command", {
            command,
            data,
         });
      }
   });

   socket.on("disconnect", () => {
      rooms.forEach((room, roomId) => {
         const userIndex = room.users.findIndex((u) => u.id === socket.id);
         if (userIndex !== -1) {
            room.users.splice(userIndex, 1);

            if (room.users.length === 0) {
               rooms.delete(roomId);
            } else {
               io.to(roomId).emit("users-update", room.users);
            }
         }
      });
   });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
   console.log(`WebSocket server running on port ${PORT}`);
});
