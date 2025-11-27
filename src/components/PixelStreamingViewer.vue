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
            <!-- Все пользователи (и администратор, и зрители) видят один и тот же iframe -->
            <iframe
               v-if="computedVagonUrl"
               ref="iframeRef"
               :src="computedVagonUrl"
               class="pixelstreaming-iframe"
               frameborder="0"
               scrolling="no"
               allow="autoplay; fullscreen; microphone; camera; gamepad"
               @load="handleIframeLoad"
               @error="handleIframeError"
            ></iframe>

            <!-- Предупреждение для зрителей, если URL еще не синхронизирован -->
            <div v-else-if="!isAdmin" class="pixelstreaming-viewer-waiting">
               <div class="pixelstreaming-viewer-waiting-content">
                  <div class="pixelstreaming-viewer-waiting-spinner"></div>
                  <p class="pixelstreaming-viewer-waiting-text">
                     <span v-if="adminUsers.length === 0">
                        Ожидание подключения администратора...
                     </span>
                     <span v-else>
                        Ожидание синхронизации потока...
                        <br />
                        <strong>{{ adminUsers[0].name }}</strong>
                     </span>
                  </p>
               </div>
            </div>
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

// Кэшируем roomId, чтобы не вычислять его каждый раз
let cachedRoomId = null;

// Генерируем ID комнаты на основе нормализованного streamUrl
// ВАЖНО: Все пользователи с одним streamUrl должны попадать в одну комнату
// Используем нормализованный streamUrl, чтобы гарантировать одинаковый roomId
const getRoomId = () => {
   // Используем кэш, если он есть
   if (cachedRoomId) {
      return cachedRoomId;
   }

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
         cachedRoomId = `room-${streamUuid}`;
         console.log("🏠 Room ID generated from stream UUID:", cachedRoomId);
         console.log("🏠 Original projectUrl:", props.projectUrl);
         console.log("🏠 Normalized streamUrl:", streamUrl);
         console.log("🏠 Extracted UUID:", streamUuid);
         return cachedRoomId;
      }

      // Если не удалось извлечь UUID, используем хеш от streamUrl
      cachedRoomId = btoa(streamUrl).replace(/[+/=]/g, "");
      console.log("🏠 Room ID generated from streamUrl hash:", cachedRoomId);
      console.log("🏠 StreamUrl:", streamUrl);
      return cachedRoomId;
   }

   cachedRoomId = "default-room";
   console.log("🏠 Using default room (no projectUrl)");
   return cachedRoomId;
};

// Синхронизированный URL для Vagon Stream (получается от сервера)
const synchronizedVagonUrl = ref(null);

// WebRTC для screen sharing (только для администратора)
const localStream = ref(null);
const remoteStream = ref(null);
const isSharingScreen = ref(false);

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
   // Больше не используем WebRTC screen sharing
   // Все пользователи видят один и тот же iframe
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

   // Больше не используем WebRTC screen sharing
   // Все пользователи видят один и тот же iframe с синхронизированным URL

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

// Обработка WebRTC offer для зрителей
const handleScreenShareOffer = async (data) => {
   try {
      const { offer, from } = data;
      console.log("📺 Handling screen share offer from:", from);

      // Закрываем предыдущее соединение, если есть
      if (peerConnection) {
         peerConnection.close();
         peerConnection = null;
      }

      // Создаем peer connection с STUN и TURN серверами
      peerConnection = new RTCPeerConnection({
         iceServers: [
            // STUN серверы
            { urls: "stun:stun.l.google.com:19302" },
            { urls: "stun:stun1.l.google.com:19302" },
            { urls: "stun:stun2.l.google.com:19302" },
            // Публичные TURN серверы для обхода NAT
            {
               urls: "turn:openrelay.metered.ca:80",
               username: "openrelayproject",
               credential: "openrelayproject",
            },
            {
               urls: "turn:openrelay.metered.ca:443",
               username: "openrelayproject",
               credential: "openrelayproject",
            },
            {
               urls: "turn:openrelay.metered.ca:443?transport=tcp",
               username: "openrelayproject",
               credential: "openrelayproject",
            },
            // Альтернативные TURN серверы
            {
               urls: "turn:relay.metered.ca:80",
               username: "openrelayproject",
               credential: "openrelayproject",
            },
            {
               urls: "turn:relay.metered.ca:443",
               username: "openrelayproject",
               credential: "openrelayproject",
            },
            // Альтернативные публичные TURN серверы
            {
               urls: "turn:relay1.expressturn.com:3478",
               username: "ef",
               credential: "es",
            },
            {
               urls: "turn:relay2.expressturn.com:3478",
               username: "ef",
               credential: "es",
            },
         ],
         iceTransportPolicy: "all", // Используем и STUN и TURN
         iceCandidatePoolSize: 10, // Увеличиваем пул кандидатов
      });

      // Обрабатываем получение потока
      peerConnection.ontrack = (event) => {
         console.log("📺 ontrack event received:", event);
         console.log("📺 Streams:", event.streams);
         console.log("📺 Track:", event.track);
         console.log("📺 Track kind:", event.track?.kind);
         console.log("📺 Track enabled:", event.track?.enabled);
         console.log("📺 Track readyState:", event.track?.readyState);

         if (event.streams && event.streams.length > 0) {
            const stream = event.streams[0];
            console.log("📺 Setting remote stream:", stream);
            console.log("📺 Stream tracks:", stream.getTracks());
            remoteStream.value = stream;

            // Используем nextTick, чтобы убедиться, что DOM обновлен
            setTimeout(() => {
               if (viewerVideo.value) {
                  console.log("📺 Setting video srcObject...");
                  viewerVideo.value.srcObject = stream;
                  console.log("📺 Video element srcObject set");

                  // Ждем метаданные видео
                  viewerVideo.value.onloadedmetadata = () => {
                     console.log(
                        "📺 Video metadata loaded, dimensions:",
                        viewerVideo.value.videoWidth,
                        "x",
                        viewerVideo.value.videoHeight
                     );
                     viewerVideo.value?.play().catch((err) => {
                        console.error("❌ Error playing video:", err);
                     });
                  };

                  // Пытаемся запустить воспроизведение сразу
                  viewerVideo.value
                     .play()
                     .then(() => {
                        console.log("✅ Video started playing");
                     })
                     .catch((err) => {
                        console.warn(
                           "⚠️ Could not play video immediately:",
                           err
                        );
                     });
               } else {
                  console.warn("⚠️ viewerVideo ref is null, will retry...");
                  // Повторяем попытку через небольшую задержку
                  setTimeout(() => {
                     if (viewerVideo.value && remoteStream.value) {
                        viewerVideo.value.srcObject = remoteStream.value;
                        viewerVideo.value.play().catch(console.error);
                     }
                  }, 100);
               }
            }, 100);
         } else if (event.track) {
            // Если потока нет, но есть трек, создаем новый поток
            console.log("📺 Creating stream from track");
            const stream = new MediaStream([event.track]);
            remoteStream.value = stream;
            setTimeout(() => {
               if (viewerVideo.value) {
                  viewerVideo.value.srcObject = stream;
                  viewerVideo.value.play().catch(console.error);
               }
            }, 100);
         } else {
            console.warn("⚠️ No streams or tracks in ontrack event");
         }
      };

      // Обрабатываем изменения состояния соединения
      peerConnection.onconnectionstatechange = () => {
         console.log("📺 Connection state:", peerConnection.connectionState);
         if (peerConnection.connectionState === "failed") {
            console.error("❌ WebRTC connection failed");
         }
      };

      peerConnection.oniceconnectionstatechange = () => {
         const state = peerConnection.iceConnectionState;
         console.log("📺 ICE connection state:", state);

         if (state === "failed") {
            console.error(
               "❌ ICE connection failed, attempting to restart ICE..."
            );
            // Пытаемся перезапустить ICE
            peerConnection.restartIce().catch((err) => {
               console.error("❌ Error restarting ICE:", err);
            });
         } else if (state === "disconnected") {
            console.warn("⚠️ ICE connection disconnected");
         } else if (state === "connected" || state === "completed") {
            console.log("✅ ICE connection established");
         }
      };

      // Обрабатываем ICE candidates
      peerConnection.onicecandidate = (event) => {
         if (event.candidate) {
            console.log("🧊 Sending ICE candidate to:", from);
            websocketService.sendIceCandidate({
               roomId: getRoomId(),
               candidate: event.candidate,
               to: from,
            });
         } else {
            console.log("🧊 ICE gathering complete");
         }
      };

      // Устанавливаем remote description
      console.log("📺 Setting remote description...");
      await peerConnection.setRemoteDescription(
         new RTCSessionDescription(offer)
      );
      console.log("✅ Remote description set");

      // Создаем answer
      console.log("📺 Creating answer...");
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
      console.log("✅ Answer created and local description set");

      // Отправляем answer
      websocketService.sendScreenShareAnswer({
         roomId: getRoomId(),
         answer: answer,
         to: from,
      });
      console.log("✅ Answer sent to:", from);
   } catch (error) {
      console.error("❌ Error handling screen share offer:", error);
      console.error("❌ Error details:", error.stack);
   }
};

// Обработка получения синхронизированного Vagon Stream URL
const handleStreamUrlUpdate = (streamUrl) => {
   if (streamUrl && typeof streamUrl === "string") {
      // Проверяем, не является ли это уже текущим URL (чтобы избежать лишних обновлений)
      if (synchronizedVagonUrl.value === streamUrl) {
         console.log("🎬 Received same synchronized URL, skipping update");
         return;
      }

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

// WebRTC для screen sharing
const viewerVideo = ref(null);
let peerConnection = null;
let dataChannel = null;

// Ссылка на iframe для захвата
const iframeRef = ref(null);

// Автоматическое начало screen sharing для администратора
// Захватываем только окно браузера с iframe
const startScreenShare = async () => {
   try {
      // Используем getDisplayMedia с параметрами для автоматического выбора текущей вкладки
      // preferCurrentTab пытается автоматически выбрать текущую вкладку
      // В Chrome 94+ это может автоматически выбрать вкладку без диалога
      const constraints = {
         video: {
            cursor: "never", // Скрываем курсор
            displaySurface: "browser", // Только окно браузера
         },
         audio: false, // Отключаем аудио
         preferCurrentTab: true, // Автоматически выбираем текущую вкладку (если поддерживается)
      };

      // Проверяем поддержку getDisplayMedia
      if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
         throw new Error("Screen sharing not supported in this browser");
      }

      console.log("📺 Requesting screen share with preferCurrentTab...");
      const stream = await navigator.mediaDevices.getDisplayMedia(constraints);

      localStream.value = stream;
      isSharingScreen.value = true;

      // Обрабатываем остановку трансляции пользователем
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
         videoTrack.addEventListener("ended", () => {
            console.log("⏹️ Screen share track ended by user");
            stopScreenShare();
         });

         // Проверяем, что захвачена именно вкладка браузера
         const settings = videoTrack.getSettings();
         console.log("📺 Video track settings:", settings);

         if (settings.displaySurface !== "browser") {
            console.warn(
               "⚠️ Warning: Captured surface is not browser tab:",
               settings.displaySurface
            );
         }
      }

      // Создаем RTCPeerConnection для каждого зрителя
      setupPeerConnectionsForViewers(stream);

      console.log(
         "✅ Screen sharing started successfully (browser tab capture)"
      );
   } catch (error) {
      console.error("❌ Error starting screen share:", error);
      isSharingScreen.value = false;

      // Если пользователь отменил или не дал разрешение
      if (error.name === "NotAllowedError" || error.name === "AbortError") {
         console.log("⚠️ Screen sharing was cancelled or denied by user");
         // Не показываем alert, просто логируем
      } else {
         console.error("❌ Unexpected error:", error);
      }
   }
};

// Хранилище peer connections для каждого зрителя
const viewerConnections = new Map();

// Настройка peer connections для всех зрителей
const setupPeerConnectionsForViewers = async (stream) => {
   const roomId = getRoomId();

   // Отправляем сигнал о начале трансляции
   websocketService.sendScreenShareStart({
      roomId: roomId,
   });

   // Подписываемся на ответы от зрителей (только один раз)
   if (!websocketService.screenShareAnswerHandler) {
      websocketService.onScreenShareAnswer(async (data) => {
         const { answer, from } = data;
         const connection = viewerConnections.get(from);
         if (connection) {
            await connection.setRemoteDescription(
               new RTCSessionDescription(answer)
            );
            console.log(`📺 Answer received from ${from}`);
         } else {
            console.warn(`⚠️ No connection found for viewer ${from}`);
         }
      });
      websocketService.screenShareAnswerHandler = true;
   }

   // Подписываемся на ICE candidates от зрителей (только один раз)
   if (!websocketService.iceCandidateHandler) {
      websocketService.onIceCandidate((data) => {
         const { candidate, from } = data;
         const connection = viewerConnections.get(from);
         if (connection && candidate) {
            connection
               .addIceCandidate(new RTCIceCandidate(candidate))
               .then(() => {
                  console.log(`✅ ICE candidate added from ${from}`);
               })
               .catch((error) => {
                  console.error(
                     `❌ Error adding ICE candidate from ${from}:`,
                     error
                  );
               });
         }
      });
      websocketService.iceCandidateHandler = true;
   }

   // Создаем peer connections для всех существующих зрителей
   const socketId = websocketService.socketInstance?.id;
   const existingViewers = connectedUsers.value.filter(
      (user) => user.role !== "admin" && user.id !== socketId
   );

   console.log(
      `📺 Setting up peer connections for ${existingViewers.length} existing viewers`
   );

   existingViewers.forEach((viewer) => {
      if (!viewerConnections.has(viewer.id)) {
         createPeerConnectionForViewer(viewer.id, stream);
         console.log(
            `📺 Creating peer connection for existing viewer: ${viewer.name} (${viewer.id})`
         );
      }
   });
};

// Создание peer connection для нового зрителя
const createPeerConnectionForViewer = async (viewerId, stream) => {
   try {
      console.log(`📺 Creating peer connection for viewer: ${viewerId}`);

      const connection = new RTCPeerConnection({
         iceServers: [
            // STUN серверы
            { urls: "stun:stun.l.google.com:19302" },
            { urls: "stun:stun1.l.google.com:19302" },
            { urls: "stun:stun2.l.google.com:19302" },
            // Публичные TURN серверы для обхода NAT
            {
               urls: "turn:openrelay.metered.ca:80",
               username: "openrelayproject",
               credential: "openrelayproject",
            },
            {
               urls: "turn:openrelay.metered.ca:443",
               username: "openrelayproject",
               credential: "openrelayproject",
            },
            {
               urls: "turn:openrelay.metered.ca:443?transport=tcp",
               username: "openrelayproject",
               credential: "openrelayproject",
            },
            // Альтернативные TURN серверы
            {
               urls: "turn:relay.metered.ca:80",
               username: "openrelayproject",
               credential: "openrelayproject",
            },
            {
               urls: "turn:relay.metered.ca:443",
               username: "openrelayproject",
               credential: "openrelayproject",
            },
            // Альтернативные публичные TURN серверы
            {
               urls: "turn:relay1.expressturn.com:3478",
               username: "ef",
               credential: "es",
            },
            {
               urls: "turn:relay2.expressturn.com:3478",
               username: "ef",
               credential: "es",
            },
         ],
         iceTransportPolicy: "all", // Используем и STUN и TURN
         iceCandidatePoolSize: 10, // Увеличиваем пул кандидатов
      });

      // Добавляем треки в peer connection
      stream.getTracks().forEach((track) => {
         connection.addTrack(track, stream);
         console.log(
            `📺 Added track to peer connection:`,
            track.kind,
            track.id
         );
      });

      // Обрабатываем ICE candidates
      connection.onicecandidate = (event) => {
         if (event.candidate) {
            const candidate = event.candidate;
            console.log(`🧊 Sending ICE candidate to viewer ${viewerId}:`, {
               type: candidate.type,
               protocol: candidate.protocol,
               address: candidate.address,
               port: candidate.port,
               priority: candidate.priority,
               foundation: candidate.foundation,
            });

            // Проверяем, есть ли relay кандидаты (от TURN серверов)
            if (candidate.type === "relay") {
               console.log(
                  `✅ Relay candidate found! TURN server is working for ${viewerId}`
               );
            }

            websocketService.sendIceCandidate({
               roomId: getRoomId(),
               candidate: event.candidate,
               to: viewerId,
            });
         } else {
            console.log(`🧊 ICE gathering complete for viewer ${viewerId}`);
            console.log(
               `🧊 Final ICE connection state: ${connection.iceConnectionState}`
            );

            // Получаем все кандидаты для диагностики
            connection.getStats().then((stats) => {
               let hasRelay = false;
               stats.forEach((report) => {
                  if (
                     report.type === "local-candidate" &&
                     report.candidateType === "relay"
                  ) {
                     hasRelay = true;
                     console.log(`✅ Found relay candidate:`, report);
                  }
               });
               if (!hasRelay) {
                  console.warn(
                     `⚠️ No relay candidates found! TURN servers may not be working.`
                  );
               }
            });
         }
      };

      // Обрабатываем изменения состояния ICE gathering
      connection.onicegatheringstatechange = () => {
         console.log(
            `🧊 ICE gathering state for ${viewerId}:`,
            connection.iceGatheringState
         );
      };

      // Обрабатываем изменения состояния соединения
      connection.onconnectionstatechange = () => {
         console.log(
            `📺 Connection state for ${viewerId}:`,
            connection.connectionState
         );
      };

      connection.oniceconnectionstatechange = () => {
         const state = connection.iceConnectionState;
         console.log(`📺 ICE connection state for ${viewerId}:`, state);

         if (state === "failed") {
            console.error(`❌ ICE connection failed for ${viewerId}`);
            console.error(`❌ Connection state: ${connection.connectionState}`);
            console.error(
               `❌ ICE gathering state: ${connection.iceGatheringState}`
            );

            // Получаем статистику соединения для диагностики
            connection.getStats().then((stats) => {
               console.log(`📊 Connection stats for ${viewerId}:`, stats);
               let hasRelay = false;
               stats.forEach((report) => {
                  if (
                     report.type === "local-candidate" &&
                     report.candidateType === "relay"
                  ) {
                     hasRelay = true;
                     console.log(`✅ Found relay candidate in stats:`, report);
                  }
                  if (
                     report.type === "candidate-pair" &&
                     report.state === "failed"
                  ) {
                     console.error(`❌ Failed candidate pair:`, report);
                  }
               });
               if (!hasRelay) {
                  console.error(
                     `❌ No relay candidates found! TURN servers are not working.`
                  );
               }
            });

            // Пытаемся перезапустить ICE
            try {
               connection.restartIce();
               console.log(`🔄 ICE restart initiated for ${viewerId}`);
            } catch (err) {
               console.error(`❌ Error restarting ICE:`, err);
               // Если перезапуск не помог, закрываем и создаем новое соединение
               console.log(
                  `🔄 Attempting to recreate connection for ${viewerId}...`
               );
               setTimeout(() => {
                  if (localStream.value && viewerConnections.has(viewerId)) {
                     viewerConnections.delete(viewerId);
                     connection.close();
                     createPeerConnectionForViewer(viewerId, localStream.value);
                  }
               }, 2000);
            }
         } else if (state === "disconnected") {
            console.warn(`⚠️ ICE connection disconnected for ${viewerId}`);
            // Пытаемся перезапустить ICE при отключении
            setTimeout(() => {
               if (connection.iceConnectionState === "disconnected") {
                  try {
                     connection.restartIce();
                     console.log(
                        `🔄 ICE restart initiated after disconnect for ${viewerId}`
                     );
                  } catch (err) {
                     console.error(
                        `❌ Error restarting ICE after disconnect:`,
                        err
                     );
                  }
               }
            }, 1000);
         } else if (state === "connected" || state === "completed") {
            console.log(`✅ ICE connection established for ${viewerId}`);
            // Получаем статистику при успешном соединении
            connection.getStats().then((stats) => {
               console.log(
                  `📊 Successful connection stats for ${viewerId}:`,
                  stats
               );
            });
         } else if (state === "checking") {
            console.log(`🔍 ICE connection checking for ${viewerId}...`);
         }
      };

      viewerConnections.set(viewerId, connection);

      // Создаем offer
      console.log(`📺 Creating offer for viewer ${viewerId}...`);
      const offer = await connection.createOffer({
         offerToReceiveAudio: false,
         offerToReceiveVideo: false,
      });
      await connection.setLocalDescription(offer);
      console.log(
         `✅ Offer created and local description set for viewer ${viewerId}`
      );

      // Отправляем offer зрителю
      websocketService.sendScreenShareOffer({
         roomId: getRoomId(),
         offer: offer,
         to: viewerId,
      });
      console.log(`✅ Offer sent to viewer ${viewerId}`);

      return connection;
   } catch (error) {
      console.error(
         `❌ Error creating peer connection for viewer ${viewerId}:`,
         error
      );
      throw error;
   }
};

// Остановка screen sharing
const stopScreenShare = () => {
   if (localStream.value) {
      localStream.value.getTracks().forEach((track) => track.stop());
      localStream.value = null;
   }
   if (peerConnection) {
      peerConnection.close();
      peerConnection = null;
   }
   isSharingScreen.value = false;
   websocketService.sendScreenShareStop({ roomId: getRoomId() });
   console.log("⏹️ Screen sharing stopped");
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

      // Больше не используем WebRTC screen sharing
      // Все пользователи видят один и тот же iframe с синхронизированным URL

      // Больше не используем WebRTC screen sharing
      // Все пользователи видят один и тот же iframe с синхронизированным URL
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
   // Больше не используем WebRTC screen sharing
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

.pixelstreaming-viewer-message {
   width: 100%;
   height: 100%;
   display: flex;
   align-items: center;
   justify-content: center;
   background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
   border-radius: 16px;
   padding: 40px;
}

.pixelstreaming-viewer-message-content {
   text-align: center;
   color: #f2f2f2;
   max-width: 500px;
}

.pixelstreaming-viewer-message-icon {
   margin-bottom: 24px;
   display: flex;
   justify-content: center;
   color: rgba(255, 255, 255, 0.9);
}

.pixelstreaming-viewer-message-title {
   font-size: 28px;
   font-weight: 600;
   margin-bottom: 16px;
   color: #ffffff;
}

.pixelstreaming-viewer-message-text {
   font-size: 18px;
   margin-bottom: 12px;
   color: rgba(255, 255, 255, 0.9);
   line-height: 1.6;
}

.pixelstreaming-viewer-message-text strong {
   color: #ffffff;
   font-weight: 600;
}

.pixelstreaming-viewer-message-hint {
   font-size: 14px;
   color: rgba(255, 255, 255, 0.7);
   margin-top: 24px;
   font-style: italic;
}

.pixelstreaming-viewer-container {
   width: 100%;
   height: 100%;
   position: relative;
   border-radius: 16px;
   overflow: hidden;
   background: #efefef;
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

.pixelstreaming-viewer-waiting-text strong {
   color: #667eea;
   font-weight: 600;
}
</style>
