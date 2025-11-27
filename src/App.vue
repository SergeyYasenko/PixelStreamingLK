<script setup>
import { ref } from "vue";
import Login from "./components/Login.vue";
import PixelStreamingViewer from "./components/PixelStreamingViewer.vue";

const isLoggedIn = ref(false);
const userData = ref({
   name: "",
   streamerId: "",
});

const handleLoginSuccess = (data) => {
   userData.value = data;
   isLoggedIn.value = true;
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
