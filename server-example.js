// Пример WebSocket сервера для управления комнатами
// Установите зависимости: npm install socket.io express cors

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

// Простой endpoint для проверки работы сервера
app.get("/", (req, res) => {
   res.json({
      status: "ok",
      message: "WebSocket server is running",
      connections: io.engine?.clientsCount || 0,
   });
});

// Health check endpoint
app.get("/health", (req, res) => {
   res.json({ status: "healthy" });
});

// Хранилище комнат и пользователей
const rooms = new Map();

// Функция для нормализации URL (такая же, как на клиенте)
function normalizeUrl(url) {
   if (!url) return null;
   let normalized = url.trim().toLowerCase();
   // Убираем протокол
   normalized = normalized.replace(/^https?:\/\//, "");
   // Убираем www.
   normalized = normalized.replace(/^www\./, "");
   // Убираем завершающий слэш
   if (normalized.endsWith("/")) {
      normalized = normalized.slice(0, -1);
   }
   return normalized;
}

io.on("connection", (socket) => {
   console.log("✅ User connected:", socket.id);
   console.log("📊 Total connections:", io.engine.clientsCount);

   // Присоединение к комнате
   socket.on("join-room", ({ roomId, user, streamUrl }) => {
      console.log(`📥 join-room event received: roomId=${roomId}, user=${user.name} (${user.role}), socketId=${socket.id}, streamUrl=${streamUrl}`);
      console.log(`🔍 DEBUG: All existing rooms:`, Array.from(rooms.keys()));

      // Нормализуем roomId на основе streamUrl для консистентности
      // Если streamUrl содержит UUID, используем его для генерации roomId
      let normalizedRoomId = roomId;
      if (streamUrl) {
         const uuidMatch = streamUrl.match(/streams\.vagon\.io\/streams\/([a-f0-9-]+)/i);
         if (uuidMatch) {
            const streamUuid = uuidMatch[1].toLowerCase().trim();
            normalizedRoomId = `room-${streamUuid}`;
            console.log(`🔄 Normalized roomId from streamUrl: ${roomId} -> ${normalizedRoomId}`);
            console.log(`🔍 Stream UUID extracted: ${streamUuid}`);
         } else {
            console.log(`⚠️ Could not extract UUID from streamUrl: ${streamUrl}`);
         }
      } else {
         console.log(`⚠️ No streamUrl provided, using original roomId: ${roomId}`);
      }

      socket.join(normalizedRoomId);

      // Инициализируем комнату, если её нет
      if (!rooms.has(normalizedRoomId)) {
         rooms.set(normalizedRoomId, {
            users: [],
            admin: null,
            streamUrl: null, // Храним синхронизированный Stream URL для комнаты
         });
         console.log(`🏠 New room created: ${normalizedRoomId}`);
      }

      const room = rooms.get(normalizedRoomId);
      console.log(`👥 Current users in room ${normalizedRoomId}:`, room.users.map(u => `${u.name} (${u.role})`).join(", "));

      // Если в комнате еще нет Stream URL, устанавливаем его из первого подключившегося пользователя
      // Или если текущий пользователь - администратор, используем его URL
      let streamUrlUpdated = false;
      if (streamUrl) {
         if (!room.streamUrl) {
            // Первый пользователь в комнате - используем его URL
            room.streamUrl = streamUrl;
            console.log(`🎬 Stream URL set for room ${normalizedRoomId}:`, streamUrl);
            streamUrlUpdated = true;
         } else if (user.role === "admin") {
            // Если администратор подключается, приоритет его URL
            room.streamUrl = streamUrl;
            console.log(`🎬 Stream URL updated by admin for room ${normalizedRoomId}:`, streamUrl);
            streamUrlUpdated = true;
         }
      }

      // Проверяем, не находится ли пользователь уже в комнате
      const existingUserIndex = room.users.findIndex((u) => u.id === socket.id);

      if (existingUserIndex !== -1) {
         // Пользователь уже в комнате, обновляем его данные
         room.users[existingUserIndex] = {
            id: socket.id,
            name: user.name,
            role: user.role,
         };
         console.log(`🔄 User ${user.name} (${user.role}) updated in room ${roomId}`);
      } else {
         // Добавляем нового пользователя в комнату
         const userData = {
            id: socket.id,
            name: user.name,
            role: user.role,
         };
         room.users.push(userData);
         console.log(`✅ User ${user.name} (${user.role}) joined room ${roomId}`);
      }

      // Если пользователь - администратор и админа еще нет, назначаем его
      if (user.role === "admin" && !room.admin) {
         room.admin = socket.id;
         console.log(`👑 Admin assigned: ${user.name} (${socket.id})`);
      }

      // Отправляем обновленный список ВСЕХ пользователей всем в комнате (независимо от роли)
      console.log(`📤 Sending users-update to room ${normalizedRoomId}:`, room.users.length, "users");
      console.log(`📋 Users list:`, room.users.map(u => `${u.name} (${u.role})`).join(", "));
      io.to(normalizedRoomId).emit("users-update", room.users);

      // ВАЖНО: Отправляем синхронизированный Stream URL сразу после users-update
      // Это гарантирует, что клиент получит URL как можно скорее
      // Отправляем только один раз, чтобы избежать дублирования
      if (room.streamUrl) {
         console.log(`🎬 Sending stream URL immediately after users-update to ${socket.id}:`, room.streamUrl);
         socket.emit("stream-url-update", room.streamUrl);
         console.log(`✅ stream-url-update event sent to ${socket.id}`);
      } else if (streamUrl) {
         room.streamUrl = streamUrl;
         console.log(`🎬 Setting and sending stream URL immediately after users-update to ${socket.id}:`, streamUrl);
         socket.emit("stream-url-update", streamUrl);
         console.log(`✅ stream-url-update event sent to ${socket.id}`);
      }

      // ВАЖНО: Отправляем синхронизированный Stream URL ВСЕМ пользователям в комнате
      // Это гарантирует, что все используют один и тот же URL
      // Используем небольшую задержку, чтобы убедиться, что клиент успел подписаться на события
      // Но отправляем только один раз через broadcast, так как уже отправили новому пользователю выше
      setTimeout(() => {
         if (room.streamUrl) {
            const clientsInRoom = io.sockets.adapter.rooms.get(normalizedRoomId);
            const clientCount = clientsInRoom ? clientsInRoom.size : 0;
            if (clientCount > 1) {
               // Отправляем только другим пользователям (не новому, так как он уже получил)
               console.log(`🎬 Broadcasting synchronized stream URL to other users in room ${normalizedRoomId}:`, room.streamUrl);
               socket.to(normalizedRoomId).emit("stream-url-update", room.streamUrl);
               console.log(`✅ stream-url-update event broadcasted to room ${normalizedRoomId}`);
            }
         }
      }, 200);
   });

   // Покидание комнаты
   socket.on("leave-room", ({ roomId }) => {
      console.log(`👋 leave-room event: socketId=${socket.id}, roomId=${roomId}`);
      console.log(`🔍 DEBUG: All existing rooms:`, Array.from(rooms.keys()));

      // Нормализуем roomId (та же логика, что и при join-room)
      let normalizedRoomId = roomId;
      // Попробуем найти комнату по любому из возможных форматов
      if (!rooms.has(roomId)) {
         // Ищем комнату по UUID из roomId
         const uuidMatch = roomId.match(/room-([a-f0-9-]+)/i);
         if (uuidMatch) {
            normalizedRoomId = roomId; // Уже нормализован
         } else {
            // Попробуем найти комнату, которая содержит этот UUID
            const uuidFromRoomId = roomId.replace(/^room-/, "");
            for (const [existingRoomId, room] of rooms.entries()) {
               if (room.streamUrl) {
                  const streamUuid = room.streamUrl.match(/streams\.vagon\.io\/streams\/([a-f0-9-]+)/i)?.[1];
                  if (streamUuid && streamUuid.toLowerCase() === uuidFromRoomId.toLowerCase()) {
                     normalizedRoomId = existingRoomId;
                     console.log(`🔄 Found matching room: ${roomId} -> ${normalizedRoomId}`);
                     break;
                  }
               }
            }
         }
      } else {
         normalizedRoomId = roomId;
      }

      socket.leave(normalizedRoomId);

      if (rooms.has(normalizedRoomId)) {
         const room = rooms.get(normalizedRoomId);
         const userBefore = room.users.find((u) => u.id === socket.id);
         room.users = room.users.filter((u) => u.id !== socket.id);

         // Если админ покинул комнату, освобождаем роль
         if (room.admin === socket.id) {
            room.admin = null;
            console.log(`👑 Admin left room ${roomId}`);
         }

         // Если комната пуста, удаляем её
         if (room.users.length === 0) {
            rooms.delete(normalizedRoomId);
            console.log(`🏠 Room ${normalizedRoomId} deleted (empty)`);
         } else {
            // Отправляем обновленный список пользователей
            console.log(`📤 Sending users-update after leave:`, room.users.length, "users remaining");
            console.log(`📋 Remaining users:`, room.users.map(u => `${u.name} (${u.role})`).join(", "));
            io.to(normalizedRoomId).emit("users-update", room.users);
         }

         if (userBefore) {
            console.log(`✅ User ${userBefore.name} (${userBefore.role}) left room ${normalizedRoomId}`);
         }
      }
   });

   // Запрос синхронизированного Stream URL (если клиент не получил его автоматически)
   socket.on("request-stream-url", ({ roomId }) => {
      console.log(`📥 request-stream-url event received: roomId=${roomId}, socketId=${socket.id}`);
      console.log(`🔍 All existing rooms:`, Array.from(rooms.keys()));

      // Нормализуем roomId
      let normalizedRoomId = roomId;
      if (roomId) {
         // Проверяем, есть ли комната с таким ID
         if (!rooms.has(roomId)) {
            // Пробуем найти комнату по UUID
            const uuidMatch = roomId.match(/room-([a-f0-9-]+)/i);
            if (uuidMatch) {
               normalizedRoomId = roomId; // Уже нормализован
            } else {
               // Ищем комнату, которая содержит этот UUID в streamUrl
               for (const [existingRoomId, room] of rooms.entries()) {
                  if (room.streamUrl) {
                     const streamUuid = room.streamUrl.match(/streams\.vagon\.io\/streams\/([a-f0-9-]+)/i)?.[1];
                     if (streamUuid && roomId.includes(streamUuid)) {
                        normalizedRoomId = existingRoomId;
                        console.log(`🔄 Found matching room: ${roomId} -> ${normalizedRoomId}`);
                        break;
                     }
                  }
               }
            }
         } else {
            normalizedRoomId = roomId;
         }
      }

      console.log(`🔍 Looking for room: ${normalizedRoomId}`);
      console.log(`🔍 Socket in rooms:`, Array.from(socket.rooms));

      if (rooms.has(normalizedRoomId)) {
         const room = rooms.get(normalizedRoomId);
         if (room.streamUrl) {
            console.log(`🎬 Sending requested stream URL to ${socket.id}:`, room.streamUrl);
            console.log(`🔍 Socket connected:`, socket.connected);
            console.log(`🔍 Socket ID:`, socket.id);
            socket.emit("stream-url-update", room.streamUrl);
            console.log(`✅ stream-url-update event sent to ${socket.id}`);

            // Дополнительная проверка - отправляем через io.to тоже
            io.to(normalizedRoomId).emit("stream-url-update", room.streamUrl);
            console.log(`✅ stream-url-update event also broadcasted to room ${normalizedRoomId}`);
         } else {
            console.log(`⚠️ No stream URL available for room ${normalizedRoomId}`);
            console.log(`🔍 Room data:`, JSON.stringify(room, null, 2));
         }
      } else {
         console.log(`⚠️ Room ${normalizedRoomId} not found`);
         console.log(`🔍 Available rooms:`, Array.from(rooms.keys()));
         console.log(`🔍 Requested roomId:`, roomId);
      }
   });

   // Команды управления (только от администратора)
   socket.on("control-command", ({ roomId, command, data }) => {
      if (rooms.has(roomId)) {
         const room = rooms.get(roomId);

         // Проверяем, что отправитель - администратор
         if (room.admin === socket.id) {
            // Отправляем команду всем в комнате (кроме отправителя)
            socket.to(roomId).emit("control-command", {
               command,
               data,
            });
            console.log(`Control command ${command} from admin in room ${roomId}`);
         } else {
            console.log(`Non-admin user tried to send control command`);
         }
      }
   });

   // Screen sharing (только для администратора)
   socket.on("screen-share-start", ({ roomId }) => {
      console.log(`📺 Screen share start from ${socket.id} in room ${roomId}`);
      // Уведомляем всех зрителей о начале трансляции
      socket.to(roomId).emit("screen-share-start", { from: socket.id });
   });

   socket.on("screen-share-offer", ({ roomId, offer, to }) => {
      console.log(`📺 Screen share offer received from ${socket.id} in room ${roomId}`);
      console.log(`📺 Offer details: type=${offer?.type}, to=${to}`);

      if (to) {
         // Отправляем конкретному зрителю
         console.log(`📺 Sending offer to specific viewer: ${to}`);
         const targetSocket = io.sockets.sockets.get(to);
         if (targetSocket) {
            console.log(`✅ Target socket found: ${to}, connected: ${targetSocket.connected}`);
            targetSocket.emit("screen-share-offer", { offer, from: socket.id });
            console.log(`✅ Offer sent to ${to}`);
         } else {
            console.error(`❌ Target socket not found: ${to}`);
            // Попробуем через комнату
            io.to(roomId).emit("screen-share-offer", { offer, from: socket.id });
            console.log(`📺 Offer broadcasted to room ${roomId} as fallback`);
         }
      } else {
         // Пересылаем offer всем зрителям в комнате
         console.log(`📺 Broadcasting offer to all viewers in room ${roomId}`);
         socket.to(roomId).emit("screen-share-offer", { offer, from: socket.id });
      }
   });

   socket.on("screen-share-answer", ({ roomId, answer, to }) => {
      console.log(`📺 Screen share answer received from ${socket.id} to ${to} in room ${roomId}`);
      // Пересылаем answer администратору
      io.to(to).emit("screen-share-answer", { answer, from: socket.id });
   });

   socket.on("ice-candidate", ({ roomId, candidate, to }) => {
      console.log(`🧊 ICE candidate received from ${socket.id} to ${to} in room ${roomId}`);
      // Пересылаем ICE candidate
      io.to(to).emit("ice-candidate", { candidate, from: socket.id });
   });

   socket.on("screen-share-stop", ({ roomId }) => {
      console.log(`⏹️ Screen share stop received from ${socket.id} in room ${roomId}`);
      // Уведомляем всех зрителей о остановке трансляции
      socket.to(roomId).emit("screen-share-stop", { from: socket.id });
   });

   // Отключение
   socket.on("disconnect", (reason) => {
      console.log("❌ User disconnected:", socket.id, "Reason:", reason);
      console.log("📊 Remaining connections:", io.engine.clientsCount);
      console.log(`🔍 DEBUG: All existing rooms before disconnect:`, Array.from(rooms.keys()));

      // Удаляем пользователя из всех комнат
      rooms.forEach((room, roomId) => {
         const userIndex = room.users.findIndex((u) => u.id === socket.id);
         if (userIndex !== -1) {
            const user = room.users[userIndex];
            room.users.splice(userIndex, 1);

            // Если админ отключился, освобождаем роль
            if (room.admin === socket.id) {
               room.admin = null;
               console.log(`👑 Admin disconnected from room ${roomId}`);
            }

            // Если комната пуста, удаляем её
            if (room.users.length === 0) {
               rooms.delete(roomId);
               console.log(`🏠 Room ${roomId} deleted (empty after disconnect)`);
            } else {
               // Отправляем обновленный список пользователей
               console.log(`📤 Sending users-update after disconnect:`, room.users.length, "users remaining");
               console.log(`📋 Remaining users in room ${roomId}:`, room.users.map(u => `${u.name} (${u.role})`).join(", "));
               io.to(roomId).emit("users-update", room.users);
            }

            console.log(`✅ User ${user.name} (${user.role}) removed from room ${roomId} due to disconnect`);
         }
      });

      console.log(`🔍 DEBUG: All existing rooms after disconnect:`, Array.from(rooms.keys()));
   });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
   console.log(`WebSocket server running on port ${PORT}`);
});

