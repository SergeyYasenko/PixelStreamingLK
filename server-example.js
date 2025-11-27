import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";

// Для Node.js версий ниже 18, может потребоваться node-fetch
// Если fetch недоступен, установите: npm install node-fetch

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
   // Отключаем кеширование для этого endpoint
   res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
   res.setHeader("Pragma", "no-cache");
   res.setHeader("Expires", "0");

   try {
      // Используем переменную окружения для хоста Pixel Streaming сервера
      // Если не задана, используем хост из запроса
      let streamServerHost = process.env.STREAM_SERVER_HOST;

      if (!streamServerHost) {
         // Получаем хост из заголовка Referer или Host
         const referer = req.get("referer") || "";
         streamServerHost = req.hostname || "localhost";

         // Пытаемся извлечь хост из Referer
         if (referer) {
            try {
               const refererUrl = new URL(referer);
               streamServerHost = refererUrl.hostname;
            } catch (e) {
               // Если не удалось распарсить, используем hostname из запроса
            }
         }

         // Если hostname все еще localhost, пробуем получить из Host заголовка
         if (streamServerHost === "localhost" || streamServerHost === "127.0.0.1") {
            const hostHeader = req.get("host");
            if (hostHeader) {
               streamServerHost = hostHeader.split(":")[0];
            }
         }
      }

      const streamServerPort = process.env.STREAM_SERVER_PORT || "80";
      const protocol = process.env.STREAM_SERVER_PROTOCOL || req.protocol || "http";
      const streamServerUrl = streamServerPort === "80" && protocol === "http"
         ? `${protocol}://${streamServerHost}`
         : streamServerPort === "443" && protocol === "https"
            ? `${protocol}://${streamServerHost}`
            : `${protocol}://${streamServerHost}:${streamServerPort}`;

      console.log(`[Proxy] ==========================================`);
      console.log(`[Proxy] Request received at: ${new Date().toISOString()}`);
      console.log(`[Proxy] Request hostname: ${req.hostname}`);
      console.log(`[Proxy] Request host header: ${req.get("host")}`);
      console.log(`[Proxy] Request referer: ${req.get("referer")}`);
      console.log(`[Proxy] STREAM_SERVER_HOST env: ${process.env.STREAM_SERVER_HOST || "not set"}`);
      console.log(`[Proxy] Determined stream server host: ${streamServerHost}`);
      console.log(`[Proxy] Attempting to fetch streamers from: ${streamServerUrl}`);
      console.log(`[Proxy] ==========================================`);

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
            console.log(`[Proxy] Response headers:`, Object.fromEntries(response.headers.entries()));

            if (response.ok) {
               const data = await response.json();
               console.log(`[Proxy] Response data type: ${typeof data}, isArray: ${Array.isArray(data)}`);
               console.log(`[Proxy] Response data:`, JSON.stringify(data, null, 2));

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
            console.log(`[Proxy] Error stack:`, error.stack);
            // Продолжаем пробовать другие endpoints
            continue;
         }
      }

      // Если API не предоставляет список, пробуем проверить доступность через прямые запросы
      // Используем список возможных StreamerId для проверки
      console.log(`[Proxy] No API endpoints worked, trying direct streamer checks`);
      console.log(`[Proxy] Will check streamers at: ${streamServerUrl}`);

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
            console.log(`[Proxy] Checking streamer: ${streamerUrl}`);

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 2000);

            try {
               const response = await fetch(streamerUrl, {
                  method: "HEAD",
                  signal: controller.signal,
               });
               clearTimeout(timeoutId);

               console.log(`[Proxy] Streamer ${streamerId} response status: ${response.status}`);

               if (response.ok || response.status < 500) {
                  availableStreamers.push(streamerId);
                  console.log(`[Proxy] ✓ Streamer ${streamerId} is available`);
               } else {
                  console.log(`[Proxy] ✗ Streamer ${streamerId} returned status ${response.status}`);
               }
            } catch (fetchError) {
               clearTimeout(timeoutId);
               console.log(`[Proxy] ✗ Streamer ${streamerId} fetch error:`, fetchError.message);
               // Игнорируем ошибки для недоступных streamers
            }
         } catch (error) {
            console.log(`[Proxy] ✗ Streamer ${streamerId} error:`, error.message);
            // Игнорируем ошибки
         }
      }

      if (availableStreamers.length > 0) {
         console.log(`[Proxy] Found ${availableStreamers.length} available streamers via direct check`);
         return res.json(availableStreamers);
      }

      // Если ни один endpoint не сработал, возвращаем пустой массив
      console.log(`[Proxy] ==========================================`);
      console.log(`[Proxy] Final result: ${availableStreamers.length} streamers found`);
      console.log(`[Proxy] Returning:`, availableStreamers.length > 0 ? availableStreamers : "[]");
      console.log(`[Proxy] ==========================================`);
      res.json(availableStreamers);
   } catch (error) {
      console.error(`[Proxy] ==========================================`);
      console.error(`[Proxy] FATAL ERROR:`, error);
      console.error(`[Proxy] Error stack:`, error.stack);
      console.error(`[Proxy] ==========================================`);
      res.status(500).json({ error: "Failed to fetch streamers", message: error.message });
   }
});

// Прокси для проверки доступности streamer
app.get("/api/proxy/check-streamer", async (req, res) => {
   // Отключаем кеширование для этого endpoint
   res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
   res.setHeader("Pragma", "no-cache");
   res.setHeader("Expires", "0");

   try {
      const { streamerId } = req.query;

      if (!streamerId) {
         return res.status(400).json({ error: "streamerId is required" });
      }

      // Используем переменную окружения или определяем автоматически
      let streamServerHost = process.env.STREAM_SERVER_HOST;

      if (!streamServerHost) {
         const referer = req.get("referer") || "";
         streamServerHost = req.hostname || "localhost";

         if (referer) {
            try {
               const refererUrl = new URL(referer);
               streamServerHost = refererUrl.hostname;
            } catch (e) {
               // Игнорируем ошибки парсинга
            }
         }

         if (streamServerHost === "localhost" || streamServerHost === "127.0.0.1") {
            const hostHeader = req.get("host");
            if (hostHeader) {
               streamServerHost = hostHeader.split(":")[0];
            }
         }
      }

      const streamServerPort = process.env.STREAM_SERVER_PORT || "80";
      const protocol = process.env.STREAM_SERVER_PROTOCOL || req.protocol || "http";
      const streamServerUrl = streamServerPort === "80" && protocol === "http"
         ? `${protocol}://${streamServerHost}`
         : streamServerPort === "443" && protocol === "https"
            ? `${protocol}://${streamServerHost}`
            : `${protocol}://${streamServerHost}:${streamServerPort}`;
      const streamerUrl = `${streamServerUrl}/?StreamerId=${streamerId}`;

      console.log(`[Check Streamer] Checking: ${streamerId} at ${streamerUrl}`);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      try {
         // Делаем GET запрос вместо HEAD для более надежной проверки
         const response = await fetch(streamerUrl, {
            method: "GET",
            signal: controller.signal,
            headers: {
               "User-Agent": "Mozilla/5.0 (compatible; StreamChecker/1.0)",
            },
         });
         clearTimeout(timeoutId);

         const status = response.status;
         const contentType = response.headers.get("content-type") || "";

         // Проверяем, что ответ успешный и это HTML страница (Pixel Streaming возвращает HTML)
         const isAvailable = (status >= 200 && status < 400) &&
            (contentType.includes("text/html") || contentType.includes("text/plain"));

         console.log(`[Check Streamer] ${streamerId}: status=${status}, contentType=${contentType}, available=${isAvailable}`);

         res.json({ available: isAvailable });
      } catch (fetchError) {
         clearTimeout(timeoutId);
         console.log(`[Check Streamer] ${streamerId}: error=${fetchError.message}`);
         res.json({ available: false });
      }
   } catch (error) {
      console.error(`[Check Streamer] Error:`, error);
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
server.listen(PORT, "0.0.0.0", () => {
   console.log("==========================================");
   console.log(`🚀 WebSocket server running on port ${PORT}`);
   console.log(`📍 Local: http://localhost:${PORT}`);
   console.log(`🌐 Network: http://0.0.0.0:${PORT}`);
   console.log(`🔧 STREAM_SERVER_HOST: ${process.env.STREAM_SERVER_HOST || "auto-detect"}`);
   console.log(`🔧 STREAM_SERVER_PORT: ${process.env.STREAM_SERVER_PORT || "80"}`);
   console.log("==========================================");
});
