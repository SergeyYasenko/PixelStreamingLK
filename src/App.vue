<script setup>
import { ref, onMounted } from "vue";
import Login from "./components/Login.vue";
import PixelStreamingViewer from "./components/PixelStreamingViewer.vue";

const isLoggedIn = ref(false);
const userData = ref({
   name: "",
   streamerId: "",
});

const STORAGE_KEY = "pixelstreaming_user";

// Восстанавливаем состояние при загрузке страницы
onMounted(() => {
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
         }
      }
   } catch (error) {
      console.error("Error loading saved user data:", error);
      localStorage.removeItem(STORAGE_KEY);
   }
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
