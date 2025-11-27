# Запуск фронтенда и WebSocket сервера одновременно

## Проблема
Нужно запустить два процесса одновременно:
- `npm run dev` - фронтенд (Vite на порту 5173)
- `npm run server` - WebSocket сервер (на порту 3001)

## Решение 1: Два терминала (рекомендуется)

### Терминал 1 (PuTTY сессия 1):
```bash
npm run server
```
Оставьте этот терминал открытым - здесь будут логи WebSocket сервера.

### Терминал 2 (PuTTY сессия 2 или новый экран):
```bash
npm run dev
```
Здесь будут логи Vite dev server.

## Решение 2: Запуск сервера в фоне

### В одном терминале:
```bash
# Запустите сервер в фоне
npm run server:bg

# Проверьте, что сервер запущен
tail -f server.log

# В том же терминале запустите фронтенд
npm run dev
```

## Решение 3: Использовать screen (для одного терминала)

```bash
# Создайте сессию screen для сервера
screen -S websocket-server
npm run server
# Нажмите Ctrl+A, затем D для отключения

# Создайте сессию screen для фронтенда
screen -S frontend
npm run dev
# Нажмите Ctrl+A, затем D для отключения

# Вернуться к серверу: screen -r websocket-server
# Вернуться к фронтенду: screen -r frontend
```

## Решение 4: Использовать PM2 (для production)

```bash
# Установите PM2
npm install -g pm2

# Запустите оба процесса через PM2
pm2 start server-example.js --name websocket-server
pm2 start "npm run dev" --name frontend

# Проверьте статус
pm2 status

# Просмотр логов
pm2 logs websocket-server
pm2 logs frontend
```

## Проверка работы

После запуска обоих процессов:

1. **Фронтенд должен быть доступен:**
   - `http://72.61.228.213:5173`

2. **WebSocket сервер должен быть доступен:**
   - `http://72.61.228.213:3001/health`
   - Проверьте: `curl http://localhost:3001/health`

3. **В браузере:**
   - Откройте `http://72.61.228.213:5173`
   - Должна загрузиться форма входа
   - При загрузке формы должны появиться логи в терминале с сервером

## Остановка

```bash
# Остановить сервер
npm run server:stop

# Или через PM2
pm2 stop all
pm2 delete all
```

