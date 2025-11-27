<script setup>
import { ref, onMounted, onUnmounted, watch } from "vue";
import Login from "./components/Login.vue";
import PixelStreamingViewer from "./components/PixelStreamingViewer.vue";

const isLoggedIn = ref(false);
const userData = ref({
   name: "",
   streamerId: "",
});

const STORAGE_KEY = "pixelstreaming_user";

// Функция для синхронизации состояния с URL
const syncStateWithUrl = () => {
   const urlParams = new URLSearchParams(window.location.search);
   const streamerId = urlParams.get("streamerId");
   const name = urlParams.get("name");

   if (streamerId && name) {
      // Если в URL есть параметры, используем их
      userData.value = { name, streamerId };
      isLoggedIn.value = true;
   } else if (isLoggedIn.value) {
      // Если пользователь залогинен, обновляем URL
      const newUrl = new URL(window.location);
      newUrl.searchParams.set("streamerId", userData.value.streamerId);
      newUrl.searchParams.set("name", userData.value.name);

      // Создаем простой объект для pushState (не Vue reactive)
      const stateData = {
         isLoggedIn: true,
         userData: {
            name: String(userData.value.name),
            streamerId: String(userData.value.streamerId),
         },
      };

      window.history.pushState(stateData, "", newUrl.toString());
   } else {
      // Если не залогинен, очищаем URL
      const newUrl = new URL(window.location);
      newUrl.search = "";
      window.history.replaceState({ isLoggedIn: false }, "", newUrl.toString());
   }
};

// Обработка кнопки "Назад" в браузере
const handlePopState = (event) => {
   if (event.state) {
      if (event.state.isLoggedIn && event.state.userData) {
         userData.value = event.state.userData;
         isLoggedIn.value = true;
      } else {
         isLoggedIn.value = false;
         userData.value = { name: "", streamerId: "" };
         localStorage.removeItem(STORAGE_KEY);
      }
   } else {
      // Если state нет, проверяем URL
      const urlParams = new URLSearchParams(window.location.search);
      const streamerId = urlParams.get("streamerId");
      const name = urlParams.get("name");

      if (streamerId && name) {
         userData.value = { name, streamerId };
         isLoggedIn.value = true;
      } else {
         isLoggedIn.value = false;
         userData.value = { name: "", streamerId: "" };
      }
   }
};

// Восстанавливаем состояние при загрузке страницы
onMounted(() => {
   // Слушаем события навигации браузера
   window.addEventListener("popstate", handlePopState);

   // Инициализируем начальное состояние в истории
   if (!window.history.state) {
      window.history.replaceState(
         { isLoggedIn: false },
         "",
         window.location.pathname
      );
   }

   // Проверяем URL параметры
   const urlParams = new URLSearchParams(window.location.search);
   const streamerId = urlParams.get("streamerId");
   const name = urlParams.get("name");

   if (streamerId && name) {
      // Если в URL есть параметры, используем их
      userData.value = { name, streamerId };
      isLoggedIn.value = true;

      // Сохраняем в localStorage
      try {
         localStorage.setItem(STORAGE_KEY, JSON.stringify(userData.value));
      } catch (error) {
         console.error("Error saving user data:", error);
      }
   } else {
      // Иначе пытаемся восстановить из localStorage
      try {
         const savedData = localStorage.getItem(STORAGE_KEY);
         if (savedData) {
            const parsed = JSON.parse(savedData);
            if (parsed.name && parsed.streamerId) {
               userData.value = {
                  name: parsed.name,
                  streamerId: parsed.streamerId,
               };
               isLoggedIn.value = true;
               // Обновляем URL
               syncStateWithUrl();
            }
         }
      } catch (error) {
         console.error("Error loading saved user data:", error);
         localStorage.removeItem(STORAGE_KEY);
      }
   }
});

// Очищаем слушатель при размонтировании
onUnmounted(() => {
   window.removeEventListener("popstate", handlePopState);
});

// Следим за изменениями состояния входа
watch(isLoggedIn, (newValue) => {
   syncStateWithUrl();
});

const handleLoginSuccess = (data) => {
   userData.value = data;
   isLoggedIn.value = true;

   // Сохраняем данные в localStorage
   try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
   } catch (error) {
      console.error("Error saving user data:", error);
   }

   // Обновляем URL и добавляем запись в историю
   syncStateWithUrl();
};
</script>

<template>
   <div id="app">
      <Login v-if="!isLoggedIn" @login-success="handleLoginSuccess" />
      <PixelStreamingViewer
         v-else
         :user-name="userData.name"
         :streamer-id="userData.streamerId"
      />
   </div>
</template>

<style>
* {
   margin: 0;
   padding: 0;
   box-sizing: border-box;
}

#app {
   width: 100%;
   height: 100vh;
   font-family: Inter, system-ui, Avenir, Helvetica, Arial, sans-serif;
   -webkit-font-smoothing: antialiased;
   -moz-osx-font-smoothing: grayscale;
}
</style>
