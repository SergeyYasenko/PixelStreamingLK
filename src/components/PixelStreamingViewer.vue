<template>
   <div class="pixelstreaming-container">
      <div class="pixelstreaming-header">
         <div class="pixelstreaming-header-wrapper">
            <div class="pixelstreaming-header-logo">
               <img src="@/assets/logo.svg" alt="PixelStreaming" />
            </div>
            <!-- <div class="pixelstreaming-header-nav">
               <ul class="pixelstreaming-header-nav-list">
                  <li class="pixelstreaming-header-nav-list-item">
                     <a
                        class="pixelstreaming-header-nav-list-item-link"
                        href="#"
                        >О нас</a
                     >
                  </li>
                  <li class="pixelstreaming-header-nav-list-item">
                     <a
                        class="pixelstreaming-header-nav-list-item-link"
                        href="#"
                        >О проекте</a
                     >
                  </li>
               </ul>
            </div> -->
            <div class="pixelstreaming-header-user">
               <div class="pixelstreaming-header-user-name">
                  <span>{{ userName }}</span>
               </div>
               <div class="pixelstreaming-header-user-avatar">
                  <img src="@/assets/icons/avatar.png" alt="User" />
               </div>
            </div>
         </div>
      </div>
      <div class="pixelstreaming-row">
         <div class="pixelstreaming-left-side">
            <div class="pixelstreaming-left-side-items">
               <div class="pixelstreaming-left-side-item">
                  <img src="@/assets/icons/settings.png" alt="Icon1" />
               </div>
               <!-- <div class="pixelstreaming-left-side-item">
                  <img src="@/assets/icons/settings.png" alt="Icon2" />
               </div>
               <div class="pixelstreaming-left-side-item">
                  <img src="@/assets/icons/settings.png" alt="Icon3" />
               </div>
               <div class="pixelstreaming-left-side-item">
                  <img src="@/assets/icons/settings.png" alt="Icon4" />
               </div>
               <div class="pixelstreaming-left-side-item">
                  <img src="@/assets/icons/settings.png" alt="Icon5" />
               </div> -->
            </div>
         </div>
         <div class="pixelstreaming-wrapper">
            <iframe
               :src="computedVagonUrl"
               class="pixelstreaming-iframe"
               frameborder="0"
               scrolling="no"
               allow="autoplay; fullscreen; microphone; camera; gamepad"
               @load="handleIframeLoad"
               @error="handleIframeError"
            ></iframe>
         </div>
         <div class="pixelstreaming-right-side">
            <div class="pixelstreaming-right-side-content">
               <div class="pixelstreaming-right-side-users">
                  <!-- Администраторы -->
                  <div
                     v-if="adminUsers.length > 0"
                     class="pixelstreaming-right-side-users-group"
                  >
                     <div class="pixelstreaming-right-side-users-group-title">
                        <span>Администратор</span>
                     </div>
                     <div
                        v-for="user in adminUsers"
                        :key="user.id"
                        class="pixelstreaming-right-side-user"
                     >
                        <div class="pixelstreaming-right-side-user-icon">
                           <img src="@/assets/icons/avatar.png" alt="User" />
                        </div>
                        <div class="pixelstreaming-right-side-user-info">
                           <div class="pixelstreaming-right-side-user-name">
                              <span>{{ user.name }}</span>
                           </div>
                        </div>
                     </div>
                  </div>

                  <!-- Наблюдатели -->
                  <div
                     v-if="viewerUsers.length > 0"
                     class="pixelstreaming-right-side-users-group"
                  >
                     <div class="pixelstreaming-right-side-users-group-title">
                        <span>Наблюдатель</span>
                     </div>
                     <div
                        v-for="user in viewerUsers"
                        :key="user.id"
                        class="pixelstreaming-right-side-user"
                     >
                        <div class="pixelstreaming-right-side-user-icon">
                           <img src="@/assets/icons/avatar.png" alt="User" />
                        </div>
                        <div class="pixelstreaming-right-side-user-info">
                           <div class="pixelstreaming-right-side-user-name">
                              <span>{{ user.name }}</span>
                           </div>
                        </div>
                     </div>
                  </div>
               </div>
            </div>
         </div>
      </div>
   </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref } from "vue";
import websocketService from "@/services/websocket";
import { getVagonStreamUrl } from "@/services/vagon";

const props = defineProps({
   // Vagon Stream Link или Stream ID
   streamUrl: {
      type: String,
      default: "",
   },
   userName: {
      type: String,
      default: "",
   },
   projectUrl: {
      type: String,
      default: "",
   },
   role: {
      type: String,
      default: "",
   },
});

// Список подключенных пользователей
const connectedUsers = ref([]);
const isAdmin = computed(() => props.role === "admin");

// Группируем пользователей по ролям
const adminUsers = computed(() => {
   return connectedUsers.value.filter((user) => user.role === "admin");
});

const viewerUsers = computed(() => {
   return connectedUsers.value.filter((user) => user.role === "viewer");
});

// Получаем название роли для текущего пользователя
const getRoleLabel = () => {
   const roleLabels = {
      admin: "Администратор",
      viewer: "Наблюдатель",
   };
   return roleLabels[props.role] || props.role || "Роль";
};

// Генерируем ID комнаты на основе нормализованного streamUrl
// ВАЖНО: Все пользователи с одним streamUrl должны попадать в одну комнату
// Используем нормализованный streamUrl, чтобы гарантировать одинаковый roomId
const getRoomId = () => {
   // Сначала получаем нормализованный streamUrl через getVagonStreamUrl
   const streamUrl = getVagonStreamUrl(props.projectUrl);

   if (streamUrl) {
      // Извлекаем UUID из нормализованного streamUrl
      // Формат: https://streams.vagon.io/streams/{UUID}
      const uuidMatch = streamUrl.match(
         /streams\.vagon\.io\/streams\/([a-f0-9-]+)/i
      );

      if (uuidMatch) {
         const streamUuid = uuidMatch[1].toLowerCase().trim();
         // Используем UUID напрямую для генерации roomId
         // Это гарантирует, что все пользователи с одним UUID попадут в одну комнату
         const roomId = `room-${streamUuid}`;
         console.log("🏠 Room ID generated from stream UUID:", roomId);
         console.log("🏠 Original projectUrl:", props.projectUrl);
         console.log("🏠 Normalized streamUrl:", streamUrl);
         console.log("🏠 Extracted UUID:", streamUuid);
         return roomId;
      }

      // Если не удалось извлечь UUID, используем хеш от streamUrl
      const roomId = btoa(streamUrl).replace(/[+/=]/g, "");
      console.log("🏠 Room ID generated from streamUrl hash:", roomId);
      console.log("🏠 StreamUrl:", streamUrl);
      return roomId;
   }

   console.log("🏠 Using default room (no projectUrl)");
   return "default-room";
};

// Синхронизированный URL для Vagon Stream (получается от сервера)
const synchronizedVagonUrl = ref(null);

// Формируем URL для Vagon Streams
// Используем синхронизированный URL, если он есть, иначе используем локальный
const computedVagonUrl = computed(() => {
   if (synchronizedVagonUrl.value) {
      console.log(
         "🎬 Using synchronized Vagon URL:",
         synchronizedVagonUrl.value
      );
      return synchronizedVagonUrl.value;
   }
   const localUrl = getVagonStreamUrl(props.projectUrl);
   console.log("🎬 Using local Vagon URL:", localUrl);
   return localUrl;
});

// Обработка загрузки iframe
const handleIframeLoad = () => {
   console.log("✅ Vagon Stream iframe loaded successfully");
};

// Обработка ошибок iframe
const handleIframeError = (event) => {
   console.error("❌ Vagon Stream iframe error:", event);
   console.error("Stream URL:", computedVagonUrl.value);
   console.error("User role:", props.role);
};

// Обработка обновления списка пользователей
const handleUsersUpdate = (users) => {
   console.log("👥 Users update received:", users);
   console.log("👥 Total users in room:", users.length);
   console.log("👥 Current user role:", props.role);

   // Отображаем ВСЕХ пользователей независимо от роли
   connectedUsers.value = users.map((user) => ({
      name: user.name,
      role: user.role,
      id: user.id,
   }));

   console.log("👥 Connected users list updated:", connectedUsers.value);
   console.log("👥 Displaying all users:", connectedUsers.value.length);

   // Если мы получили обновление пользователей, но еще не получили синхронизированный URL,
   // запрашиваем его (на случай, если автоматическая отправка не сработала)
   if (!synchronizedVagonUrl.value && users.length > 0) {
      console.log(
         "⏰ Received users update but no synchronized URL yet, requesting..."
      );
      setTimeout(() => {
         if (!synchronizedVagonUrl.value) {
            websocketService.requestStreamUrl();
         }
      }, 300);
   }
};

// Обработка получения синхронизированного Vagon Stream URL
const handleStreamUrlUpdate = (streamUrl) => {
   console.log("🎬 handleStreamUrlUpdate called with:", streamUrl);
   console.log("🎬 Type:", typeof streamUrl);
   if (streamUrl && typeof streamUrl === "string") {
      console.log("🎬 Received synchronized stream URL:", streamUrl);
      console.log("🎬 Current synchronized URL:", synchronizedVagonUrl.value);
      console.log("🎬 Will update iframe with new URL");
      synchronizedVagonUrl.value = streamUrl;
      console.log(
         "🎬 Updated synchronizedVagonUrl.value to:",
         synchronizedVagonUrl.value
      );
      // Vue автоматически обновит iframe через computed property computedVagonUrl
   } else {
      console.warn("⚠️ Received invalid stream URL update:", streamUrl);
   }
};

// Инициализация WebSocket при монтировании
onMounted(() => {
   // Подключаемся к WebSocket серверу
   // ВАЖНО: Замените на адрес вашего WebSocket сервера
   const wsServerUrl =
      import.meta.env.VITE_WS_SERVER_URL || "http://localhost:3001";

   console.log("🔌 Connecting to WebSocket server:", wsServerUrl);
   const socket = websocketService.connect(wsServerUrl);

   // Ждем подключения перед присоединением к комнате
   const joinRoomAfterConnect = () => {
      // ВАЖНО: Подписываемся на события ДО присоединения к комнате
      // чтобы не пропустить события, которые сервер отправляет сразу после join-room

      console.log("🔔 Setting up event listeners before joining room...");

      // Подписываемся на обновления пользователей
      websocketService.onUsersUpdate(handleUsersUpdate);
      console.log("✅ Subscribed to users-update events");

      // Подписываемся на обновления синхронизированного Stream URL
      websocketService.onStreamUrlUpdate(handleStreamUrlUpdate);
      console.log("✅ Subscribed to stream-url-update events");

      // Подписываемся на команды управления (для синхронизации)
      websocketService.onControlCommand((data) => {
         // Здесь можно обрабатывать команды управления от администратора
         console.log("🎮 Control command received:", data);
      });
      console.log("✅ Subscribed to control-command events");

      const roomId = getRoomId();
      const localStreamUrl = getVagonStreamUrl(props.projectUrl);
      console.log("📝 Joining room:", roomId);
      console.log("👤 User data:", { name: props.userName, role: props.role });
      console.log("🎬 Local stream URL:", localStreamUrl);

      websocketService.joinRoom(roomId, {
         name: props.userName,
         role: props.role,
         streamUrl: localStreamUrl, // Отправляем локальный URL при подключении
      });

      console.log("📤 join-room event sent, waiting for server response...");

      // Запрашиваем синхронизированный URL через небольшую задержку, если не получили автоматически
      setTimeout(() => {
         if (!synchronizedVagonUrl.value) {
            console.log(
               "⏰ No synchronized URL received, requesting from server..."
            );
            websocketService.requestStreamUrl();
         }
      }, 500); // Запрашиваем через 500ms, если не получили автоматически
   };

   if (socket && socket.connected) {
      joinRoomAfterConnect();
   } else {
      socket?.once("connect", joinRoomAfterConnect);
   }
});

// Отключение при размонтировании
onUnmounted(() => {
   websocketService.leaveRoom();
   websocketService.removeAllListeners();
});
</script>

<style scoped>
.pixelstreaming-container {
   display: flex;
   flex-direction: column;
   justify-content: center;
   align-items: center;
   width: 100%;
   height: 100vh;
   box-sizing: border-box;
   overflow: hidden;
}

.pixelstreaming-header {
   width: 100%;
   max-width: 1740px;
   height: 120px;
   padding: 14px 20px;
}

.pixelstreaming-header-nav {
   width: 100%;
}

.pixelstreaming-header-nav-list {
   display: flex;
   justify-content: space-evenly;
   align-items: center;
   list-style: none;
   margin: 0;
   padding: 0;
}

.pixelstreaming-header-nav-list-item-link {
   font-size: 32px;
   color: #f2f2f2;
   text-decoration: none;
   transition: all 0.3s ease;
}

.pixelstreaming-header-nav-list-item-link:hover {
   opacity: 0.8;
   transition: all 0.3s ease;
}

.pixelstreaming-header-user {
   display: flex;
   justify-content: center;
   align-items: center;
   gap: 16px;
}

.pixelstreaming-header-wrapper {
   display: flex;
   justify-content: space-between;
   align-items: center;
}

.pixelstreaming-header-user-name {
   font-size: 22px;
   color: #f2f2f2;
}

.pixelstreaming-header-user-avatar {
   width: 90px;
   height: 90px;
   border-radius: 50%;
   overflow: hidden;
}

.pixelstreaming-row {
   display: flex;
   justify-content: space-evenly;
   align-items: center;
   width: 100%;
}

.pixelstreaming-left-side-items {
   max-height: 100vh;
   display: flex;
   justify-content: center;
   flex-direction: column;
   align-items: center;
   padding: 20px;
   gap: 50px;
}

.pixelstreaming-left-side-item {
   display: flex;
   justify-content: center;
   align-items: center;
   padding: 10px;
   background: #efefef;
   border-radius: 16px;
   cursor: pointer;
   transition: all 0.3s ease;
   &:hover {
      opacity: 0.8;
   }
}

.user-info {
   margin-bottom: 20px;
   padding: 12px 24px;
   background: rgba(0, 0, 0, 0.3);
   backdrop-filter: blur(10px);
   border-radius: 16px;
}

.user-name {
   color: #f2f2f2;
   font-size: 1.25rem;
   font-weight: 600;
}

.pixelstreaming-wrapper {
   width: 100%;
   max-width: 1740px;
   height: 100vh;
   max-height: 800px;
   border-radius: 16px;
   box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
   background-color: #efefef;
   overflow: hidden;
   position: relative;
   box-sizing: border-box;
   flex: 1;
   min-height: 0;
   padding: 20px;
}

.pixelstreaming-iframe {
   width: 100%;
   height: 100%;
   border: none;
   display: block;
   overflow: hidden;
   border-radius: 16px;
}

.pixelstreaming-right-side {
   display: flex;
   flex-direction: column;
   align-items: center;
   padding: 20px;
   min-width: 200px;
}

.pixelstreaming-right-side-content {
   display: flex;
   flex-direction: column;
   width: 100%;
   gap: 20px;
}

.pixelstreaming-right-side-users {
   display: flex;
   flex-direction: column;
   gap: 24px;
   max-height: calc(100vh - 200px);
   overflow-y: auto;
}

.pixelstreaming-right-side-users-group {
   display: flex;
   flex-direction: column;
   gap: 8px;
}

.pixelstreaming-right-side-users-group-title {
   font-size: 24px;
   font-weight: 600;
   color: #f2f2f2;
   text-align: center;
   padding: 12px;
   background: rgba(0, 0, 0, 0.3);
   backdrop-filter: blur(10px);
   border-radius: 16px;
}

.pixelstreaming-right-side-user {
   display: flex;
   align-items: center;
   gap: 12px;
   padding: 12px;
   background: rgba(0, 0, 0, 0.3);
   backdrop-filter: blur(10px);
   border-radius: 16px;
   transition: all 0.3s ease;
}

.pixelstreaming-right-side-user:hover {
   background: rgba(0, 0, 0, 0.5);
}

.pixelstreaming-right-side-user-icon {
   width: 40px;
   height: 40px;
   border-radius: 50%;
   overflow: hidden;
   flex-shrink: 0;
}

.pixelstreaming-right-side-user-icon img {
   width: 100%;
   height: 100%;
   object-fit: cover;
}

.pixelstreaming-right-side-user-info {
   display: flex;
   flex-direction: column;
   gap: 4px;
   flex: 1;
}

.pixelstreaming-right-side-user-name {
   font-size: 18px;
   color: #f2f2f2;
   font-weight: 500;
}

.pixelstreaming-right-side-user-role {
   font-size: 12px;
   color: rgba(242, 242, 242, 0.7);
}

.pixelstreaming-right-side-users::-webkit-scrollbar {
   width: 6px;
}

.pixelstreaming-right-side-users::-webkit-scrollbar-track {
   background: rgba(0, 0, 0, 0.2);
   border-radius: 10px;
}

.pixelstreaming-right-side-users::-webkit-scrollbar-thumb {
   background: rgba(255, 255, 255, 0.3);
   border-radius: 10px;
}

.pixelstreaming-right-side-users::-webkit-scrollbar-thumb:hover {
   background: rgba(255, 255, 255, 0.5);
}
</style>
