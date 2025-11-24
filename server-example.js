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

io.on("connection", (socket) => {
   console.log("✅ User connected:", socket.id);
   console.log("📊 Total connections:", io.engine.clientsCount);

   // Присоединение к комнате
   socket.on("join-room", ({ roomId, user }) => {
      socket.join(roomId);

      // Инициализируем комнату, если её нет
      if (!rooms.has(roomId)) {
         rooms.set(roomId, {
            users: [],
            admin: null,
         });
      }

      const room = rooms.get(roomId);

      // Если пользователь - администратор и админа еще нет, назначаем его
      if (user.role === "admin" && !room.admin) {
         room.admin = socket.id;
      }

      // Добавляем пользователя в комнату
      const userData = {
         id: socket.id,
         name: user.name,
         role: user.role,
      };

      room.users.push(userData);

      // Отправляем обновленный список пользователей всем в комнате
      io.to(roomId).emit("users-update", room.users);

      console.log(`User ${user.name} (${user.role}) joined room ${roomId}`);
   });

   // Покидание комнаты
   socket.on("leave-room", ({ roomId }) => {
      socket.leave(roomId);

      if (rooms.has(roomId)) {
         const room = rooms.get(roomId);
         room.users = room.users.filter((u) => u.id !== socket.id);

         // Если админ покинул комнату, освобождаем роль
         if (room.admin === socket.id) {
            room.admin = null;
         }

         // Если комната пуста, удаляем её
         if (room.users.length === 0) {
            rooms.delete(roomId);
         } else {
            // Отправляем обновленный список пользователей
            io.to(roomId).emit("users-update", room.users);
         }
      }

      console.log(`User left room ${roomId}`);
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

   // Отключение
   socket.on("disconnect", (reason) => {
      console.log("❌ User disconnected:", socket.id, "Reason:", reason);
      console.log("📊 Remaining connections:", io.engine.clientsCount);

      // Удаляем пользователя из всех комнат
      rooms.forEach((room, roomId) => {
         const userIndex = room.users.findIndex((u) => u.id === socket.id);
         if (userIndex !== -1) {
            room.users.splice(userIndex, 1);

            // Если админ отключился, освобождаем роль
            if (room.admin === socket.id) {
               room.admin = null;
            }

            // Если комната пуста, удаляем её
            if (room.users.length === 0) {
               rooms.delete(roomId);
            } else {
               // Отправляем обновленный список пользователей
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

