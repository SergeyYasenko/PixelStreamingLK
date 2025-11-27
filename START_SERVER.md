# Инструкция по запуску WebSocket сервера

## Проблема
Если WebSocket сервер запущен на Railway, он не может достучаться до Pixel Streaming сервера на `72.61.228.213:80` из-за сетевых ограничений.

## Решение
Запустите WebSocket сервер на том же сервере, где фронтенд (`72.61.228.213`).

## Вариант 1: Запуск в фоне через nohup

```bash
# Остановите текущий процесс, если запущен
pkill -f "node server-example.js"

# Запустите сервер в фоне
nohup npm run server > server.log 2>&1 &

# Проверьте, что сервер запустился
tail -f server.log
```

## Вариант 2: Запуск через PM2 (рекомендуется)

```bash
# Установите PM2 глобально (если еще не установлен)
npm install -g pm2

# Запустите сервер через PM2
pm2 start server-example.js --name pixelstreaming-ws

# Проверьте статус
pm2 status

# Просмотр логов
pm2 logs pixelstreaming-ws

# Автозапуск при перезагрузке сервера
pm2 startup
pm2 save
```

## Вариант 3: Запуск через screen

```bash
# Создайте новую сессию screen
screen -S websocket-server

# Запустите сервер
npm run server

# Отключитесь от screen (Ctrl+A, затем D)
# Для возврата: screen -r websocket-server
```

## Проверка работы

После запуска сервер должен быть доступен на:
- `http://72.61.228.213:3001`
- `http://72.61.228.213:3001/api/proxy/streamers`

Проверьте в браузере или через curl:
```bash
curl http://72.61.228.213:3001/health
```

## Переменные окружения (опционально)

Если нужно явно указать хост Pixel Streaming сервера:
```bash
export STREAM_SERVER_HOST=72.61.228.213
export STREAM_SERVER_PORT=80
npm run server
```

Или создайте файл `.env`:
```
STREAM_SERVER_HOST=72.61.228.213
STREAM_SERVER_PORT=80
STREAM_SERVER_PROTOCOL=http
```

## Порт

По умолчанию сервер запускается на порту **3001**. Убедитесь, что порт открыт в firewall:
```bash
# Для Ubuntu/Debian
sudo ufw allow 3001/tcp
```

