<template>
   <div class="login-wrapper">
      <video class="background-video" autoplay muted loop playsinline>
         <source :src="loginVideo" type="video/mp4" />
      </video>
      <div class="background-video-overlay"></div>

      <div class="login-content">
         <div class="login-form">
            <h2 class="login-title">Вход</h2>
            <form @submit.prevent="handleLogin">
               <div class="form-group">
                  <label for="name">Имя</label>
                  <input
                     type="text"
                     id="name"
                     v-model="name"
                     placeholder="Введите ваше имя"
                     class="form-group-input"
                  />
               </div>
               <div class="form-group">
                  <label for="streamerId" class="form-group-label">
                     Комната (Streamer ID)<span class="required">*</span>
                  </label>
                  <div
                     ref="streamerSelectElement"
                     class="select-wrapper"
                     :class="{
                        'is-open': isStreamerSelectOpen,
                        'has-error': streamerError,
                        'is-disabled': availableRooms.length === 0,
                     }"
                  >
                     <input
                        type="hidden"
                        name="streamerId"
                        :value="selectedStreamerId"
                        required
                     />
                     <button
                        type="button"
                        id="streamerId"
                        class="custom-select-button"
                        :class="{
                           'has-value': selectedStreamerId,
                           'is-disabled': availableRooms.length === 0,
                        }"
                        :disabled="availableRooms.length === 0"
                        @mousedown="handleStreamerSelectMouseDown"
                     >
                        <span class="select-button-text">
                           {{
                              availableRooms.length === 0
                                 ? "Нет доступных комнат"
                                 : getSelectedStreamerLabel()
                           }}
                        </span>
                     </button>
                     <div
                        v-if="isStreamerSelectOpen && availableRooms.length > 0"
                        class="custom-select-dropdown"
                     >
                        <div
                           v-for="room in availableRooms"
                           :key="room.streamerId"
                           class="custom-select-option"
                           :class="{
                              'is-selected':
                                 selectedStreamerId === room.streamerId,
                           }"
                           @click="selectStreamerOption(room.streamerId)"
                        >
                           {{ room.label }}
                        </div>
                     </div>
                  </div>
                  <p v-if="isLoadingRooms" class="form-hint">
                     Загрузка списка комнат...
                  </p>
                  <p
                     v-else-if="availableRooms.length === 0"
                     class="form-hint"
                     :class="{ 'form-hint-error': streamerError }"
                  >
                     {{
                        streamerError
                           ? "Ошибка подключения к серверу. Проверьте, что WebSocket сервер запущен."
                           : "Нет доступных комнат. Проверьте подключение к серверу."
                     }}
                  </p>
               </div>
               <button
                  type="submit"
                  class="login-button"
                  :disabled="availableRooms.length === 0 || !selectedStreamerId"
               >
                  Подключиться
               </button>
            </form>
         </div>
      </div>
   </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from "vue";
import loginVideo from "@/assets/login-bg-video.mp4";

const emit = defineEmits(["login-success"]);

const name = ref("");
const selectedStreamerId = ref("");
const availableRooms = ref([]);
const isLoadingRooms = ref(false);
const isStreamerSelectOpen = ref(false);
const streamerSelectElement = ref(null);
const streamerError = ref(false);

const getStreamServerUrl = () => {
   // Используем тот же хост, что и у фронтенда, но порт 80 для Pixel Streaming
   const host = window.location.hostname;
   const port = import.meta.env.VITE_STREAM_PORT || "80";
   const protocol = window.location.protocol === "https:" ? "https:" : "http:";
   // Если порт 80, не добавляем его в URL (стандартный HTTP порт)
   if (port === "80" && protocol === "http:") {
      return `${protocol}//${host}`;
   }
   if (port === "443" && protocol === "https:") {
      return `${protocol}//${host}`;
   }
   return `${protocol}//${host}:${port}`;
};

const getWebSocketServerUrl = () => {
   // Используем тот же хост, что и у фронтенда, но порт 3001 для WebSocket сервера
   const host = window.location.hostname;
   const wsPort = import.meta.env.VITE_WS_SERVER_PORT || "3001";
   const protocol = window.location.protocol === "https:" ? "https:" : "http:";
   // Если есть переменная окружения, используем её
   if (import.meta.env.VITE_WS_SERVER_URL) {
      return import.meta.env.VITE_WS_SERVER_URL;
   }
   return `${protocol}//${host}:${wsPort}`;
};

const fetchAvailableRooms = async () => {
   isLoadingRooms.value = true;
   streamerError.value = false;

   try {
      const streamServerUrl = getStreamServerUrl();

      // Используем прокси через наш WebSocket сервер для обхода CORS
      const wsServerUrl = getWebSocketServerUrl();
      const proxyEndpoint = `${wsServerUrl}/api/proxy/streamers`;

      try {
         // Добавляем timestamp для предотвращения кеширования
         const cacheBuster = `?t=${Date.now()}`;
         const response = await fetch(`${proxyEndpoint}${cacheBuster}`, {
            method: "GET",
            headers: {
               "Content-Type": "application/json",
               "Cache-Control": "no-cache",
               Pragma: "no-cache",
            },
         });

         if (response.ok) {
            const streamersList = await response.json();

            if (
               streamersList &&
               Array.isArray(streamersList) &&
               streamersList.length > 0
            ) {
               // Проверяем доступность каждого streamer через прокси
               const checkedRooms = [];

               // Функция для проверки доступности streamer через прокси
               const checkStreamerAvailability = async (streamerId, label) => {
                  try {
                     // Добавляем cache-buster для предотвращения кеширования
                     const cacheBuster = `&t=${Date.now()}`;
                     const checkResponse = await fetch(
                        `${wsServerUrl}/api/proxy/check-streamer?streamerId=${encodeURIComponent(
                           streamerId
                        )}${cacheBuster}`,
                        {
                           method: "GET",
                           headers: {
                              "Content-Type": "application/json",
                              "Cache-Control": "no-cache",
                              Pragma: "no-cache",
                           },
                        }
                     );

                     if (checkResponse.ok) {
                        const result = await checkResponse.json();
                        if (result.available) {
                           return { streamerId, label };
                        }
                     }
                     return null;
                  } catch (checkError) {
                     console.error(
                        `Error checking streamer ${streamerId}:`,
                        checkError
                     );
                     return null;
                  }
               };

               // Проверяем все streamers параллельно
               const checkPromises = streamersList.map(async (item) => {
                  const streamerId =
                     typeof item === "string"
                        ? item
                        : item.id || item.streamerId || item.sessionId;
                  const label =
                     typeof item === "string"
                        ? item
                        : item.name || item.label || streamerId;

                  return await checkStreamerAvailability(streamerId, label);
               });

               const results = await Promise.all(checkPromises);
               checkedRooms.push(...results.filter((room) => room !== null));

               availableRooms.value = checkedRooms;
               isLoadingRooms.value = false;
               return;
            }
         }
      } catch (proxyError) {
         // Если прокси недоступен, список остается пустым
         console.error("Error fetching streamers:", proxyError);
         streamerError.value = true;
      }

      // Если прокси не вернул список, оставляем список пустым
      // НЕ используем дефолтные значения - только реальные данные от сервера
      if (availableRooms.value.length === 0) {
         streamerError.value = true;
      } else {
         // Если есть доступные комнаты, выбираем первую по умолчанию
         if (!selectedStreamerId.value && availableRooms.value.length > 0) {
            selectedStreamerId.value = availableRooms.value[0].streamerId;
         }
      }
   } catch (error) {
      // В случае ошибки список остается пустым
      console.error("Error in fetchAvailableRooms:", error);
      availableRooms.value = [];
      streamerError.value = true;
   } finally {
      isLoadingRooms.value = false;
   }
};

const getSelectedStreamerLabel = () => {
   if (!selectedStreamerId.value) {
      return "Выберите комнату";
   }
   const selected = availableRooms.value.find(
      (room) => room.streamerId === selectedStreamerId.value
   );
   return selected ? selected.label : selectedStreamerId.value;
};

const handleStreamerSelectMouseDown = (event) => {
   if (event.button !== 0 || availableRooms.value.length === 0) {
      return;
   }
   event.preventDefault();
   isStreamerSelectOpen.value = !isStreamerSelectOpen.value;
};

const selectStreamerOption = (streamerId) => {
   selectedStreamerId.value = streamerId;
   isStreamerSelectOpen.value = false;
   streamerError.value = false;
};

const handleDocumentMouseDown = (event) => {
   if (event.button !== 0) {
      return;
   }
   if (
      streamerSelectElement.value &&
      !streamerSelectElement.value.contains(event.target)
   ) {
      isStreamerSelectOpen.value = false;
   }
};

onMounted(() => {
   document.addEventListener("mousedown", handleDocumentMouseDown);
   fetchAvailableRooms();
});

onUnmounted(() => {
   document.removeEventListener("mousedown", handleDocumentMouseDown);
});

const handleLogin = () => {
   if (!selectedStreamerId.value) {
      streamerError.value = true;
      isStreamerSelectOpen.value = true;
      return;
   }

   if (availableRooms.value.length === 0) {
      return;
   }

   streamerError.value = false;

   const finalName = name.value.trim() || "Гость";

   emit("login-success", {
      name: finalName,
      streamerId: selectedStreamerId.value,
   });
};
</script>

<style scoped>
.login-wrapper {
   width: 100%;
   height: 100vh;
   position: relative;
   overflow: hidden;
}

.background-video {
   width: 100%;
   height: 100%;
   object-fit: cover;
   position: absolute;
   top: 0;
   left: 0;
   z-index: 0;
   filter: blur(5px);
}

.background-video-overlay {
   position: absolute;
   top: 0;
   left: 0;
   width: 100%;
   height: 100%;
   background: rgba(255, 255, 255, 0.2);
}
.login-content {
   position: relative;
   z-index: 1;
   width: 100%;
   height: 100%;
   display: flex;
   align-items: center;
   justify-content: center;
}

.login-form {
   background: rgba(0, 0, 0, 0.3);
   backdrop-filter: blur(10px);
   padding: 1.875rem;
   border-radius: 16px;
   width: 100%;
   max-width: 540px;
}

.login-title {
   font-size: 3rem;
   margin-bottom: 1.375rem;
   color: #f2f2f2;
}

.form-group {
   margin-bottom: 1.875rem;
}

.form-group-label {
   display: block;
   margin-bottom: 0.9375rem;
   color: #f2f2f2;
}

.form-group-label .required {
   color: #e74c3c;
   margin-left: 2px;
}

.form-group-input {
   width: 100%;
   padding-left: 0;
   color: #f2f2f2;
   font-size: 1rem;
   font-family: inherit;
   border: none;
   border-bottom: 1px solid #d9d9d9;
   border-radius: 0;
   transition: border-color 0.3s;
   background-color: transparent;
}

.form-group-input::placeholder {
   color: #f2f2f2;
}

.form-group-input:focus {
   outline: none;
}

.form-hint {
   margin-top: 0.5rem;
   font-size: 0.875rem;
   color: rgba(242, 242, 242, 0.7);
}

.form-hint-error {
   color: #e74c3c;
   font-weight: 500;
}

.select-wrapper {
   position: relative;
   display: inline-block;
   width: 100%;
}

.select-wrapper.is-disabled .custom-select-button {
   opacity: 0.5;
   cursor: not-allowed;
}

.select-wrapper::after {
   content: "";
   position: absolute;
   right: 20px;
   top: 50%;
   transform: translateY(-50%) rotate(45deg);
   pointer-events: none;
   width: 6px;
   height: 6px;
   border-right: 2px solid #f2f2f2;
   border-bottom: 2px solid #f2f2f2;
   transition: transform 0.3s ease;
}

.select-wrapper.is-open::after {
   transform: translateY(-50%) rotate(225deg);

   transition: transform 0.3s ease;
}

.select-wrapper.has-error .custom-select-button {
   border: 1px solid #e74c3c;
   background-color: rgba(231, 76, 60, 0.2);
}

.custom-select-button {
   width: 100%;
   cursor: pointer;
   background-color: rgba(217, 217, 217, 0.4);
   border: none;
   border-radius: 16px;
   padding: 1.25rem;
   padding-right: 2.5rem;
   color: #f2f2f2;
   font-size: 1rem;
   font-family: inherit;
   text-align: left;
   position: relative;
   transition: background-color 0.3s;
}

.custom-select-button:hover:not(:disabled) {
   background-color: rgba(217, 217, 217, 0.5);
}

.custom-select-button:disabled,
.custom-select-button.is-disabled {
   cursor: not-allowed;
   opacity: 0.6;
}

.select-button-text {
   display: block;
}

.custom-select-dropdown {
   position: absolute;
   top: calc(100% + 8px);
   left: 0;
   right: 0;
   background-color: rgba(217, 217, 217, 0.4);
   border-radius: 16px;
   overflow: hidden;
   z-index: 10;
   backdrop-filter: blur(10px);
}

.custom-select-option {
   padding: 1.25rem;
   color: #f2f2f2;
   font-size: 1rem;
   cursor: pointer;
   transition: background-color 0.2s;
   background-color: rgba(217, 217, 217, 0.4);
}

.custom-select-option:hover {
   background-color: rgba(217, 217, 217, 0.6);
}

.custom-select-option.is-selected {
   background-color: rgba(217, 217, 217, 0.4);
   color: #f2f2f2;
   font-weight: 500;
}

.login-button {
   width: 100%;
   padding: 1.25rem;
   background: rgba(43, 43, 43, 0.8);
   color: #f2f2f2;
   border: none;
   border-radius: 16px;
   font-size: 1rem;
   font-weight: 600;
   cursor: pointer;
   transition: background 0.3s;
   outline: none;
}

.login-button:hover:not(:disabled) {
   background: rgba(43, 43, 43, 0.3);
}

.login-button:disabled {
   opacity: 0.5;
   cursor: not-allowed;
}

.login-button:focus,
.login-button:active {
   outline: none;
   border: none;
}
</style>
