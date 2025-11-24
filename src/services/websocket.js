import { io } from "socket.io-client";

class WebSocketService {
   constructor() {
      this.socket = null;
      this.roomId = null;
      this.isConnected = false;
   }

   // Подключение к WebSocket серверу
   connect(serverUrl = "http://localhost:3001") {
      if (this.socket?.connected) {
         console.log("✅ Already connected to WebSocket");
         return this.socket;
      }

      console.log("🔌 Attempting to connect to:", serverUrl);
      this.socket = io(serverUrl, {
         transports: ["websocket", "polling"],
         reconnection: true,
         reconnectionDelay: 1000,
         reconnectionAttempts: 5,
         timeout: 20000,
      });

      this.socket.on("connect", () => {
         this.isConnected = true;
         console.log("✅ WebSocket connected:", this.socket.id);
      });

      this.socket.on("disconnect", (reason) => {
         this.isConnected = false;
         console.log("❌ WebSocket disconnected:", reason);
      });

      this.socket.on("connect_error", (error) => {
         console.error("❌ WebSocket connection error:", error.message);
         console.error("Trying to connect to:", serverUrl);
      });

      this.socket.on("reconnect", (attemptNumber) => {
         console.log("🔄 WebSocket reconnected after", attemptNumber, "attempts");
      });

      this.socket.on("reconnect_error", (error) => {
         console.error("❌ WebSocket reconnection error:", error.message);
      });

      this.socket.on("reconnect_failed", () => {
         console.error("❌ WebSocket reconnection failed");
      });

      return this.socket;
   }

   // Присоединение к комнате (на основе projectUrl)
   joinRoom(roomId, userData) {
      if (!this.socket) {
         console.error("❌ Socket not connected");
         return;
      }

      if (!this.socket.connected) {
         console.error("❌ Socket not connected, waiting for connection...");
         this.socket.once("connect", () => {
            this.roomId = roomId;
            this.socket.emit("join-room", {
               roomId,
               user: {
                  name: userData.name,
                  role: userData.role,
                  id: this.socket.id,
               },
            });
            console.log("✅ Joined room:", roomId);
         });
         return;
      }

      this.roomId = roomId;
      this.socket.emit("join-room", {
         roomId,
         user: {
            name: userData.name,
            role: userData.role,
            id: this.socket.id,
         },
      });
      console.log("✅ Joining room:", roomId, "as", userData.role);
   }

   // Покидание комнаты
   leaveRoom() {
      if (this.socket && this.roomId) {
         this.socket.emit("leave-room", { roomId: this.roomId });
         this.roomId = null;
      }
   }

   // Получение списка пользователей в комнате
   onUsersUpdate(callback) {
      if (this.socket) {
         this.socket.on("users-update", callback);
      }
   }

   // Отправка команды управления (только для администратора)
   sendControlCommand(command, data) {
      if (this.socket && this.roomId) {
         this.socket.emit("control-command", {
            roomId: this.roomId,
            command,
            data,
         });
      }
   }

   // Получение команд управления (для синхронизации)
   onControlCommand(callback) {
      if (this.socket) {
         this.socket.on("control-command", callback);
      }
   }

   // Отключение
   disconnect() {
      if (this.socket) {
         this.leaveRoom();
         this.socket.disconnect();
         this.socket = null;
         this.isConnected = false;
      }
   }

   // Удаление всех слушателей
   removeAllListeners() {
      if (this.socket) {
         this.socket.removeAllListeners();
      }
   }
}

// Экспортируем singleton
export default new WebSocketService();

