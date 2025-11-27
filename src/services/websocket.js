import { io } from "socket.io-client";

class WebSocketService {
   constructor() {
      this.socket = null;
      this.roomId = null;
      this.isConnected = false;
   }

   get socketInstance() {
      return this.socket;
   }

   connect(serverUrl = "http://localhost:3001") {
      if (this.socket?.connected) {
         return this.socket;
      }

      this.socket = io(serverUrl, {
         transports: ["websocket", "polling"],
         reconnection: true,
         reconnectionDelay: 1000,
         reconnectionAttempts: 5,
         timeout: 20000,
      });

      this.socket.on("connect", () => {
         this.isConnected = true;
      });

      this.socket.on("disconnect", () => {
         this.isConnected = false;
      });

      return this.socket;
   }

   joinRoom(roomId, userData) {
      if (!this.socket) {
         return;
      }

      if (!this.socket.connected) {
         this.socket.once("connect", () => {
            this.roomId = roomId;
            this.socket.emit("join-room", {
               roomId,
               user: {
                  name: userData.name,
                  id: this.socket.id,
               },
               streamUrl: userData.streamUrl,
            });
         });
         return;
      }

      this.roomId = roomId;
      this.socket.emit("join-room", {
         roomId,
         user: {
            name: userData.name,
            id: this.socket.id,
         },
         streamUrl: userData.streamUrl,
      });
   }

   leaveRoom() {
      if (this.socket && this.roomId) {
         this.socket.emit("leave-room", { roomId: this.roomId });
         this.roomId = null;
      }
   }

   onUsersUpdate(callback) {
      if (this.socket) {
         this.socket.on("users-update", callback);
      }
   }

   requestStreamUrl() {
      if (!this.socket || !this.roomId || !this.socket.connected) {
         return;
      }

      this.socket.emit("request-stream-url", { roomId: this.roomId });
   }

   sendControlCommand(command, data) {
      if (this.socket && this.roomId) {
         this.socket.emit("control-command", {
            roomId: this.roomId,
            command,
            data,
         });
      }
   }

   onControlCommand(callback) {
      if (this.socket) {
         this.socket.on("control-command", callback);
      }
   }

   onStreamUrlUpdate(callback) {
      if (this.socket) {
         this.socket.off("stream-url-update");
         const handler = (streamUrl) => {
            if (streamUrl && typeof streamUrl === "string") {
               callback(streamUrl);
            }
         };
         this.socket.on("stream-url-update", handler);
      }
   }

   disconnect() {
      if (this.socket) {
         this.leaveRoom();
         this.socket.disconnect();
         this.socket = null;
         this.isConnected = false;
      }
   }

   removeAllListeners() {
      if (this.socket) {
         this.socket.removeAllListeners();
      }
   }
}

export default new WebSocketService();
