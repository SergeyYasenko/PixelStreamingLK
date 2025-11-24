# Деплой проекта на удаленный сервер

## Архитектура

- **Фронтенд (Vue)**: Vercel / Netlify (бесплатно)
- **Бэкенд (WebSocket сервер)**: Railway / Render (бесплатно, поддерживают WebSocket)

---

## Вариант 1: Vercel (Фронтенд) + Railway (Бэкенд) - Рекомендуется

### Шаг 1: Деплой фронтенда на Vercel

1. Зарегистрируйтесь на https://vercel.com (бесплатно)
2. Установите Vercel CLI:
```bash
npm install -g vercel
```

3. В корне проекта создайте `vercel.json`:
```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "devCommand": "npm run dev",
  "installCommand": "npm install"
}
```

4. Деплой:
```bash
vercel
```

5. После деплоя получите URL вида: `https://your-project.vercel.app`

### Шаг 2: Деплой бэкенда на Railway

1. Зарегистрируйтесь на https://railway.app (бесплатно, $5 кредитов в месяц)
2. Создайте новый проект
3. Подключите GitHub репозиторий или загрузите код
4. Railway автоматически определит Node.js проект
5. Установите переменную окружения `PORT` (Railway установит автоматически)
6. После деплоя получите URL вида: `https://your-project.up.railway.app`

### Шаг 3: Настройка переменных окружения

В Vercel добавьте переменную окружения:
```
VITE_WS_SERVER_URL=https://your-project.up.railway.app
```

---

## Вариант 2: Netlify (Фронтенд) + Render (Бэкенд)

### Шаг 1: Деплой фронтенда на Netlify

1. Зарегистрируйтесь на https://netlify.com (бесплатно)
2. Создайте файл `netlify.toml` в корне проекта:
```toml
[build]
  command = "npm run build"
  publish = "dist"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

3. Загрузите проект через Netlify Dashboard или используйте Netlify CLI:
```bash
npm install -g netlify-cli
netlify deploy --prod
```

### Шаг 2: Деплой бэкенда на Render

1. Зарегистрируйтесь на https://render.com (бесплатно)
2. Создайте новый Web Service
3. Подключите GitHub репозиторий
4. Настройки:
   - Build Command: `npm install`
   - Start Command: `node server-example.js`
   - Environment: Node
5. Добавьте переменную окружения `PORT` (Render установит автоматически)
6. После деплоя получите URL вида: `https://your-project.onrender.com`

### Шаг 3: Настройка переменных окружения

В Netlify добавьте переменную окружения:
```
VITE_WS_SERVER_URL=https://your-project.onrender.com
```

---

## Вариант 3: Все на одном сервере (VPS)

Если у вас есть VPS (например, от DigitalOcean, AWS, или другого провайдера):

1. Установите Node.js и PM2:
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
sudo npm install -g pm2
```

2. Загрузите проект на сервер
3. Установите зависимости:
```bash
npm install
```

4. Запустите бэкенд через PM2:
```bash
pm2 start server-example.js --name websocket-server
pm2 save
pm2 startup
```

5. Настройте Nginx для фронтенда и проксирования WebSocket:
```nginx
server {
    listen 80;
    server_name your-domain.com;

    # Фронтенд
    location / {
        root /path/to/your/project/dist;
        try_files $uri $uri/ /index.html;
    }

    # WebSocket прокси
    location /socket.io/ {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}
```

---

## Быстрый старт с Railway (Рекомендуется)

Railway поддерживает и фронтенд, и бэкенд:

1. Зарегистрируйтесь на https://railway.app
2. Создайте два сервиса:
   - Один для фронтенда (Vite)
   - Один для бэкенда (WebSocket сервер)
3. Настройте переменные окружения
4. Готово!

---

## Важные моменты

1. **CORS**: Убедитесь, что бэкенд разрешает запросы с домена фронтенда
2. **WebSocket**: Не все хостинги поддерживают WebSocket (Railway и Render поддерживают)
3. **Переменные окружения**: Используйте переменные окружения для URL сервера
4. **HTTPS**: Все современные хостинги предоставляют HTTPS автоматически

---

## Пример конфигурации для production

Создайте `.env.production`:
```env
VITE_WS_SERVER_URL=https://your-backend-url.com
```

Vite автоматически использует этот файл при `npm run build`.

