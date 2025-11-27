<template>
   <div class="pixelstreaming-container">
      <div class="pixelstreaming-header">
         <div class="pixelstreaming-header-wrapper">
            <div class="pixelstreaming-header-logo">
               <img src="@/assets/logo.svg" alt="PixelStreaming" />
            </div>
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
            </div>
         </div>
         <div class="pixelstreaming-wrapper">
            <iframe
               v-if="computedStreamUrl"
               ref="iframeRef"
               :src="computedStreamUrl"
               class="pixelstreaming-iframe"
               frameborder="0"
               scrolling="no"
               allow="autoplay; fullscreen; microphone; camera; gamepad"
               @load="handleIframeLoad"
               @error="handleIframeError"
            ></iframe>

            <div v-else class="pixelstreaming-viewer-waiting">
               <div class="pixelstreaming-viewer-waiting-content">
                  <div class="pixelstreaming-viewer-waiting-spinner"></div>
                  <p class="pixelstreaming-viewer-waiting-text">
                     Ожидание подключения...
                  </p>
               </div>
            </div>
         </div>
         <div class="pixelstreaming-right-side">
            <div class="pixelstreaming-right-side-content">
               <div class="pixelstreaming-right-side-users">
                  <div
                     v-if="connectedUsers.length > 0"
                     class="pixelstreaming-right-side-users-group"
                  >
                     <div class="pixelstreaming-right-side-users-group-title">
                        <span>Участники ({{ connectedUsers.length }})</span>
                     </div>
                     <div
                        v-for="user in connectedUsers"
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

const props = defineProps({
   userName: {
      type: String,
      default: "",
   },
   streamerId: {
      type: String,
      default: "",
   },
});

const connectedUsers = ref([]);
const synchronizedStreamUrl = ref(null);
const iframeRef = ref(null);

const getStreamServerUrl = () => {
   const host = import.meta.env.VITE_STREAM_SERVER_HOST || "72.61.228.213";
   const port = import.meta.env.VITE_STREAM_PORT || "80";
   const protocol = window.location.protocol === "https:" ? "https:" : "http:";
   const streamerId = props.streamerId || "DefaultStreamer";
   return `${protocol}//${host}:${port}/?StreamerId=${streamerId}`;
};

const computedStreamUrl = computed(() => {
   if (synchronizedStreamUrl.value) {
      return synchronizedStreamUrl.value;
   }
   return getStreamServerUrl();
});

const handleIframeLoad = () => {};

const handleIframeError = () => {};

const handleUsersUpdate = (users) => {
   connectedUsers.value = users.map((user) => ({
      name: user.name,
      id: user.id,
   }));

   if (!synchronizedStreamUrl.value && users.length > 0) {
      setTimeout(() => {
         if (!synchronizedStreamUrl.value) {
            websocketService.requestStreamUrl();
         }
      }, 300);
   }
};

const handleStreamUrlUpdate = (streamUrl) => {
   if (streamUrl && typeof streamUrl === "string") {
      const streamServerUrl = getStreamServerUrl();
      if (synchronizedStreamUrl.value === streamServerUrl) {
         return;
      }
      synchronizedStreamUrl.value = streamServerUrl;
   }
};

onMounted(() => {
   const wsServerUrl =
      import.meta.env.VITE_WS_SERVER_URL || "http://localhost:3001";

   const socket = websocketService.connect(wsServerUrl);

   const joinRoomAfterConnect = () => {
      websocketService.onUsersUpdate(handleUsersUpdate);
      websocketService.onStreamUrlUpdate(handleStreamUrlUpdate);
      websocketService.onControlCommand(() => {});

      const roomId = props.streamerId || "DefaultStreamer";
      const streamServerUrl = getStreamServerUrl();

      websocketService.joinRoom(roomId, {
         name: props.userName,
         streamUrl: streamServerUrl,
      });

      setTimeout(() => {
         if (!synchronizedStreamUrl.value) {
            websocketService.requestStreamUrl();
         }
      }, 500);
   };

   if (socket && socket.connected) {
      joinRoomAfterConnect();
   } else {
      socket?.once("connect", joinRoomAfterConnect);
   }
});

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

.pixelstreaming-header-wrapper {
   display: flex;
   justify-content: space-between;
   align-items: center;
}

.pixelstreaming-header-user {
   display: flex;
   justify-content: center;
   align-items: center;
   gap: 16px;
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
}

.pixelstreaming-left-side-item:hover {
   opacity: 0.8;
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

.pixelstreaming-viewer-waiting {
   width: 100%;
   height: 100%;
   display: flex;
   align-items: center;
   justify-content: center;
   background: #efefef;
   border-radius: 16px;
}

.pixelstreaming-viewer-waiting-content {
   text-align: center;
   color: #666;
}

.pixelstreaming-viewer-waiting-spinner {
   width: 48px;
   height: 48px;
   border: 4px solid rgba(102, 126, 234, 0.2);
   border-top-color: #667eea;
   border-radius: 50%;
   animation: spin 1s linear infinite;
   margin: 0 auto 24px;
}

@keyframes spin {
   to {
      transform: rotate(360deg);
   }
}

.pixelstreaming-viewer-waiting-text {
   font-size: 16px;
   color: #666;
   line-height: 1.6;
}
</style>
