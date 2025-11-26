import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

// https://vite.dev/config/
export default defineConfig({
   plugins: [vue()],
   resolve: {
      alias: {
         '@': fileURLToPath(new URL('./src', import.meta.url))
      }
   },
   server: {
      host: '0.0.0.0', // Разрешаем доступ извне
      port: 5173,
      allowedHosts: [
         'localhost',
         '.loca.lt', // Разрешаем все поддомены localtunnel
         '.ngrok.io', // На случай использования ngrok
         '.ngrok-free.app', // На случай использования ngrok
         '.ngrok-free.dev', // На случай использования ngrok (новый домен)
      ],
      hmr: {
         clientPort: 443, // Для HTTPS туннелей
      }
   }
})
