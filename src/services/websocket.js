import { io } from "socket.io-client";

class WebSocketService {
   constructor() {
      this.socket = null;
      this.roomId = null;
      this.isConnected = false;
   }

   // Геттер для доступа к socket извне
   get socketInstance() {
      return this.socket;
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
         console.error("Error details:", error);
         console.error("Trying to connect to:", serverUrl);
         console.error("Check if backend is accessible at:", serverUrl);
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
            console.log("💾 Room ID saved:", this.roomId);
            this.socket.emit("join-room", {
               roomId,
               user: {
                  name: userData.name,
                  role: userData.role,
                  id: this.socket.id,
               },
               streamUrl: userData.streamUrl, // Отправляем Stream URL
            });
            console.log("✅ Joined room:", roomId);
         });
         return;
      }

      this.roomId = roomId;
      console.log("💾 Room ID saved:", this.roomId);
      this.socket.emit("join-room", {
         roomId,
         user: {
            name: userData.name,
            role: userData.role,
            id: this.socket.id,
         },
         streamUrl: userData.streamUrl, // Отправляем Stream URL
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

   // Запрос синхронизированного Stream URL
   requestStreamUrl() {
      if (!this.socket) {
         console.error("❌ Cannot request stream URL: socket is null");
         return;
      }
      if (!this.roomId) {
         console.error("❌ Cannot request stream URL: roomId is null");
         return;
      }
      if (!this.socket.connected) {
         console.error("❌ Cannot request stream URL: socket is not connected");
         return;
      }

      console.log("📤 Requesting stream URL from server for room:", this.roomId);
      console.log("📤 Socket connected:", this.socket.connected);
      console.log("📤 Socket ID:", this.socket.id);

      this.socket.emit("request-stream-url", { roomId: this.roomId }, (response) => {
         console.log("📥 Response from request-stream-url:", response);
      });
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

   // Получение обновлений синхронизированного Stream URL
   onStreamUrlUpdate(callback) {
      if (this.socket) {
         // Удаляем старый обработчик, если он есть, чтобы избежать дублирования
         this.socket.off("stream-url-update");
         // Добавляем новый обработчик
         const handler = (streamUrl) => {
            console.log("📡 stream-url-update event received:", streamUrl);
            console.log("📡 Socket ID:", this.socket.id);
            console.log("📡 Socket connected:", this.socket.connected);
            console.log("📡 Event type:", typeof streamUrl);
            if (streamUrl && typeof streamUrl === 'string') {
               callback(streamUrl);
            } else {
               console.error("❌ Invalid stream URL received:", streamUrl);
            }
         };
         this.socket.on("stream-url-update", handler);
         console.log("✅ Subscribed to stream-url-update events");

         // Проверяем, что обработчик действительно зарегистрирован
         const listeners = this.socket.listeners("stream-url-update");
         console.log("🔍 Registered listeners for stream-url-update:", listeners.length);
      } else {
         console.error("❌ Cannot subscribe to stream-url-update: socket is null");
      }
   }

   // Отправка screen share start (для администратора)
   sendScreenShareStart(data) {
      if (this.socket && this.roomId) {
         this.socket.emit("screen-share-start", {
            roomId: this.roomId,
            ...data,
         });
      }
   }

   // Отправка screen share offer (для администратора)
   sendScreenShareOffer(data) {
      if (this.socket && this.roomId) {
         this.socket.emit("screen-share-offer", {
            roomId: this.roomId,
            ...data,
         });
      }
   }

   // Отправка screen share answer (для зрителей)
   sendScreenShareAnswer(data) {
      if (this.socket && this.roomId) {
         this.socket.emit("screen-share-answer", {
            roomId: this.roomId,
            ...data,
         });
      }
   }

   // Отправка ICE candidate
   sendIceCandidate(data) {
      if (this.socket && this.roomId) {
         this.socket.emit("ice-candidate", {
            roomId: this.roomId,
            ...data,
         });
      }
   }

   // Отправка screen share stop (для администратора)
   sendScreenShareStop(data) {
      if (this.socket && this.roomId) {
         this.socket.emit("screen-share-stop", {
            roomId: this.roomId,
            ...data,
         });
      }
   }

   // Получение screen share start (для зрителей)
   onScreenShareStart(callback) {
      if (this.socket) {
         this.socket.on("screen-share-start", callback);
      }
   }

   // Получение screen share offer (для зрителей)
   onScreenShareOffer(callback) {
      if (this.socket) {
         this.socket.on("screen-share-offer", callback);
      }
   }

   // Получение screen share answer (для администратора)
   onScreenShareAnswer(callback) {
      if (this.socket) {
         this.socket.on("screen-share-answer", callback);
      }
   }

   // Получение ICE candidate
   onIceCandidate(callback) {
      if (this.socket) {
         this.socket.on("ice-candidate", callback);
      }
   }

   // Получение screen share stream (для зрителей)
   onScreenShareStream(callback) {
      if (this.socket) {
         this.socket.on("screen-share-stream", callback);
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

