<template>
   <div class="login-wrapper">
      <video class="background-video" autoplay muted loop playsinline>
         <source :src="loginVideo" type="video/mp4" />
         <!-- Fallback если видео не загрузится -->
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
                  <label for="projectUrl" class="form-group-label"
                     >Ссылка на проект<span class="required">*</span></label
                  >
                  <input
                     type="url"
                     id="projectUrl"
                     v-model="projectUrl"
                     placeholder="https://example.com"
                     required
                     class="form-group-input"
                  />
               </div>
               <div class="form-group">
                  <label for="role" class="form-group-label">
                     Роль<span class="required">*</span>
                  </label>
                  <div
                     ref="selectElement"
                     class="select-wrapper"
                     :class="{
                        'is-open': isSelectOpen,
                        'has-error': roleError,
                     }"
                  >
                     <input type="hidden" name="role" :value="role" required />
                     <button
                        type="button"
                        id="role"
                        class="custom-select-button"
                        :class="{ 'has-value': role }"
                        @mousedown="handleSelectMouseDown"
                     >
                        <span class="select-button-text">
                           {{ getSelectedRoleLabel() }}
                        </span>
                     </button>
                     <div v-if="isSelectOpen" class="custom-select-dropdown">
                        <div
                           v-for="option in filteredRoleOptions"
                           :key="option.value"
                           class="custom-select-option"
                           :class="{ 'is-selected': role === option.value }"
                           @click="selectOption(option.value)"
                        >
                           {{ option.label }}
                        </div>
                     </div>
                  </div>
               </div>
               <button type="submit" class="login-button">Войти</button>
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
const projectUrl = ref("");
const role = ref("");
const isSelectOpen = ref(false);
const selectElement = ref(null);
const roleError = ref(false);

const roleOptions = [
   { value: "", label: "Выберите роль" },
   { value: "admin", label: "Администратор" },
   { value: "viewer", label: "Наблюдатель" },
];

// Фильтруем опции: если роль выбрана, убираем опцию "Выберите роль"
const filteredRoleOptions = computed(() => {
   if (role.value) {
      return roleOptions.filter((opt) => opt.value !== "");
   }
   return roleOptions;
});

const getSelectedRoleLabel = () => {
   const selected = roleOptions.find((opt) => opt.value === role.value);
   return selected ? selected.label : "Выберите роль";
};

const handleSelectMouseDown = (event) => {
   // Реагируем только на левую кнопку мыши (button === 0)
   if (event.button !== 0) {
      return;
   }
   event.preventDefault();
   // Открываем/закрываем при клике на select
   isSelectOpen.value = !isSelectOpen.value;
};

const selectOption = (value) => {
   role.value = value;
   isSelectOpen.value = false;
   roleError.value = false; // Убираем ошибку при выборе
};

const handleDocumentMouseDown = (event) => {
   // Реагируем только на левую кнопку мыши (button === 0)
   if (event.button !== 0) {
      return;
   }
   // Закрываем при клике вне select
   if (selectElement.value && !selectElement.value.contains(event.target)) {
      isSelectOpen.value = false;
   }
};

onMounted(() => {
   document.addEventListener("mousedown", handleDocumentMouseDown);
});

onUnmounted(() => {
   document.removeEventListener("mousedown", handleDocumentMouseDown);
});

const handleLogin = () => {
   // Валидация: проверяем, что роль выбрана
   if (!role.value) {
      roleError.value = true;
      isSelectOpen.value = true; // Открываем список для выбора
      return;
   }

   roleError.value = false;

   // Если имя пустое, устанавливаем "Гость"
   const finalName = name.value.trim() || "Гость";

   // Отправляем данные на родительский компонент
   emit("login-success", {
      name: finalName,
      projectUrl: projectUrl.value,
      role: role.value,
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

.form-group-input,
.form-group-input-select {
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

.form-group-input:focus,
.form-group-input-select:focus {
   outline: none;
}

.select-wrapper {
   position: relative;
   display: inline-block;
   width: 100%;
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

.custom-select-button:hover {
   background-color: rgba(217, 217, 217, 0.5);
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

.login-button:hover {
   background: rgba(43, 43, 43, 0.3);
}

.login-button:focus,
.login-button:active {
   outline: none;
   border: none;
}
</style>
