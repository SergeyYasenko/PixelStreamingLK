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
               :src="computedStreamUrl"
               class="pixelstreaming-iframe"
               frameborder="0"
               scrolling="no"
               allow="autoplay; fullscreen; microphone; camera"
            ></iframe>
         </div>
         <div class="pixelstreaming-right-side">
            <div class="pixelstreaming-right-side-content">
               <div class="pixelstreaming-right-side-role">
                  <span>{{ getRoleLabel() }}</span>
               </div>
               <div class="pixelstreaming-right-side-users">
                  <div
                     v-for="(user, index) in connectedUsers"
                     :key="index"
                     class="pixelstreaming-right-side-user"
                  >
                     <div class="pixelstreaming-right-side-user-icon">
                        <img src="@/assets/icons/avatar.png" alt="User" />
                     </div>
                     <div class="pixelstreaming-right-side-user-name">
                        <span>{{ user.name }}</span>
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

const props = defineProps({
   streamUrl: {
      type: String,
      default: "https://share.streampixel.io/692201c94a9ae9b3794166b7",
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

// Получаем название роли
const getRoleLabel = () => {
   const roleLabels = {
      admin: "Администратор",
      viewer: "Наблюдатель",
   };
   return roleLabels[props.role] || props.role || "Роль";
};

// Генерируем ID комнаты на основе projectUrl
const getRoomId = () => {
   if (props.projectUrl) {
      // Используем projectUrl как идентификатор комнаты
      return btoa(props.projectUrl).replace(/[+/=]/g, "");
   }
   return "default-room";
};

// Формируем URL с параметрами для отправки данных
const computedStreamUrl = computed(() => {
   const baseUrl = props.streamUrl;
   const params = new URLSearchParams();

   if (props.userName) {
      params.append("name", props.userName);
   }
   if (props.projectUrl) {
      params.append("projectUrl", props.projectUrl);
   }
   if (props.role) {
      params.append("role", props.role);
   }

   // Для зрителей добавляем read-only режим
   if (!isAdmin.value) {
      params.append("readonly", "true");
   }

   const queryString = params.toString();
   return queryString ? `${baseUrl}?${queryString}` : baseUrl;
});

// Обработка обновления списка пользователей
const handleUsersUpdate = (users) => {
   console.log("👥 Users update received:", users);
   connectedUsers.value = users.map((user) => ({
      name: user.name,
      role: user.role,
      id: user.id,
   }));
   console.log("👥 Connected users list updated:", connectedUsers.value);
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
      const roomId = getRoomId();
      console.log("📝 Joining room:", roomId);
      console.log("👤 User data:", { name: props.userName, role: props.role });

      websocketService.joinRoom(roomId, {
         name: props.userName,
         role: props.role,
      });

      // Подписываемся на обновления пользователей
      websocketService.onUsersUpdate(handleUsersUpdate);

      // Подписываемся на команды управления (для синхронизации)
      websocketService.onControlCommand((data) => {
         // Здесь можно обрабатывать команды управления от администратора
         console.log("🎮 Control command received:", data);
      });
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

.pixelstreaming-right-side-role {
   font-size: 24px;
   font-weight: 600;
   color: #f2f2f2;
   text-align: center;
   padding: 12px;
   background: rgba(0, 0, 0, 0.3);
   backdrop-filter: blur(10px);
   border-radius: 16px;
}

.pixelstreaming-right-side-users {
   display: flex;
   flex-direction: column;
   gap: 16px;
   max-height: calc(100vh - 200px);
   overflow-y: auto;
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

.pixelstreaming-right-side-user-name {
   font-size: 18px;
   color: #f2f2f2;
   flex: 1;
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
