# Настройка туннеля для тестирования WebSocket сервера

## Вариант 1: localtunnel (Рекомендуется - полностью бесплатно)

### Установка:
```bash
npm install -g localtunnel
```

### Использование:
1. Запустите ваш WebSocket сервер:
```bash
node server-example.js
```

2. В другом терминале создайте туннель:
```bash
lt --port 3001
```

3. Вы получите публичный URL, например: `https://random-name.loca.lt`

4. Обновите адрес сервера в `.env` или в коде:
```env
VITE_WS_SERVER_URL=https://random-name.loca.lt
```

⚠️ **Важно**: localtunnel требует HTTPS, но Socket.IO автоматически обработает это.

---

## Вариант 2: ngrok (Требует регистрацию, но более стабильный)

### Установка:
1. Зарегистрируйтесь на https://ngrok.com (бесплатно)
2. Скачайте ngrok и добавьте в PATH
3. Получите authtoken на сайте

### Использование:
```bash
ngrok http 3001
```

Вы получите публичный URL вида: `https://xxxx-xx-xx-xx-xx.ngrok-free.app`

---

## Вариант 3: Cloudflare Tunnel (Бесплатно, без ограничений)

### Установка:
```bash
npm install -g cloudflared
```

### Использование:
```bash
cloudflared tunnel --url http://localhost:3001
```

---

## Быстрый старт с localtunnel:

```bash
# Терминал 1: Запустите сервер
node server-example.js

# Терминал 2: Создайте туннель
lt --port 3001

# Скопируйте полученный URL и используйте его в приложении
```

