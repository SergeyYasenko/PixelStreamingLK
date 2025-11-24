<script setup>
import { ref } from "vue";
import Login from "./components/Login.vue";
import PixelStreamingViewer from "./components/PixelStreamingViewer.vue";

const isLoggedIn = ref(false);
const userData = ref({
   name: "",
   projectUrl: "",
   role: "",
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
         :stream-url="
            userData.projectUrl ||
            'https://share.streampixel.io/692201c94a9ae9b3794166b7'
         "
         :user-name="userData.name"
         :project-url="userData.projectUrl"
         :role="userData.role"
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
