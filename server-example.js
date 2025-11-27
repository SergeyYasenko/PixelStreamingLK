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

// Прокси для получения списка streamers от Pixel Streaming сервера
// Это обходит CORS ограничения
app.get("/api/proxy/streamers", async (req, res) => {
   try {
      // Используем тот же хост, что и у запроса, но порт 80 для Pixel Streaming
      const streamServerHost = req.get("host")?.split(":")[0] || req.hostname || "localhost";
      const streamServerPort = process.env.STREAM_SERVER_PORT || "80";
      const protocol = req.protocol || "http";
      const streamServerUrl = streamServerPort === "80" && protocol === "http"
         ? `${protocol}://${streamServerHost}`
         : streamServerPort === "443" && protocol === "https"
            ? `${protocol}://${streamServerHost}`
            : `${protocol}://${streamServerHost}:${streamServerPort}`;

      console.log(`[Proxy] Attempting to fetch streamers from: ${streamServerUrl}`);

      const possibleEndpoints = [
         "/api/streamers",
         "/streamers",
         "/api/list",
         "/list",
         "/api/sessions",
         "/sessions",
      ];

      for (const endpoint of possibleEndpoints) {
         try {
            const fullUrl = `${streamServerUrl}${endpoint}`;
            console.log(`[Proxy] Trying endpoint: ${fullUrl}`);

            const response = await fetch(fullUrl, {
               method: "GET",
               headers: {
                  "Content-Type": "application/json",
               },
            });

            console.log(`[Proxy] Response status: ${response.status} for ${fullUrl}`);

            if (response.ok) {
               const data = await response.json();
               console.log(`[Proxy] Response data:`, data);

               let streamersList = null;

               if (Array.isArray(data)) {
                  streamersList = data;
               } else if (data.streamers && Array.isArray(data.streamers)) {
                  streamersList = data.streamers;
               } else if (data.list && Array.isArray(data.list)) {
                  streamersList = data.list;
               } else if (data.sessions && Array.isArray(data.sessions)) {
                  streamersList = data.sessions;
               }

               if (streamersList && streamersList.length > 0) {
                  console.log(`[Proxy] Found ${streamersList.length} streamers`);
                  return res.json(streamersList);
               }
            }
         } catch (error) {
            console.log(`[Proxy] Error for endpoint ${endpoint}:`, error.message);
            // Продолжаем пробовать другие endpoints
            continue;
         }
      }

      // Если API не предоставляет список, пробуем проверить доступность через прямые запросы
      // Используем список возможных StreamerId для проверки
      console.log(`[Proxy] No API endpoints worked, trying direct streamer checks`);
      const possibleStreamerIds = [
         "DefaultStreamer",
         "Streamer1",
         "Streamer2",
         "Streamer3",
      ];

      const availableStreamers = [];

      for (const streamerId of possibleStreamerIds) {
         try {
            const streamerUrl = `${streamServerUrl}/?StreamerId=${streamerId}`;
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 1000);

            try {
               const response = await fetch(streamerUrl, {
                  method: "HEAD",
                  signal: controller.signal,
               });
               clearTimeout(timeoutId);

               if (response.ok || response.status < 500) {
                  availableStreamers.push(streamerId);
                  console.log(`[Proxy] Streamer ${streamerId} is available`);
               }
            } catch (fetchError) {
               clearTimeout(timeoutId);
               // Игнорируем ошибки для недоступных streamers
            }
         } catch (error) {
            // Игнорируем ошибки
         }
      }

      if (availableStreamers.length > 0) {
         console.log(`[Proxy] Found ${availableStreamers.length} available streamers via direct check`);
         return res.json(availableStreamers);
      }

      // Если ни один endpoint не сработал, возвращаем пустой массив
      console.log(`[Proxy] No streamers found, returning empty array`);
      res.json([]);
   } catch (error) {
      console.error(`[Proxy] Error:`, error);
      res.status(500).json({ error: "Failed to fetch streamers", message: error.message });
   }
});

// Прокси для проверки доступности streamer
app.get("/api/proxy/check-streamer", async (req, res) => {
   try {
      const { streamerId } = req.query;

      if (!streamerId) {
         return res.status(400).json({ error: "streamerId is required" });
      }

      // Используем тот же хост, что и у запроса, но порт 80 для Pixel Streaming
      const streamServerHost = req.get("host")?.split(":")[0] || req.hostname || "localhost";
      const streamServerPort = process.env.STREAM_SERVER_PORT || "80";
      const protocol = req.protocol || "http";
      const streamServerUrl = streamServerPort === "80" && protocol === "http"
         ? `${protocol}://${streamServerHost}`
         : streamServerPort === "443" && protocol === "https"
            ? `${protocol}://${streamServerHost}`
            : `${protocol}://${streamServerHost}:${streamServerPort}`;
      const streamerUrl = `${streamServerUrl}/?StreamerId=${streamerId}`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);

      try {
         const response = await fetch(streamerUrl, {
            method: "HEAD",
            signal: controller.signal,
         });
         clearTimeout(timeoutId);
         res.json({ available: response.ok || response.status < 500 });
      } catch (fetchError) {
         clearTimeout(timeoutId);
         res.json({ available: false });
      }
   } catch (error) {
      res.json({ available: false });
   }
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
