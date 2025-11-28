// Диагностика подключения между WebSocket сервером и Pixel Streaming
import { execSync } from 'child_process';

console.log('🔍 Диагностика подключения WebSocket сервера и Pixel Streaming\n');
console.log('='.repeat(60));

// 1. Проверка, запущен ли WebSocket сервер
console.log('\n1️⃣  Проверка WebSocket сервера (порт 3001):\n');
try {
   const response = await fetch('http://localhost:3001/health');
   if (response.ok) {
      const data = await response.json();
      console.log('   ✅ WebSocket сервер запущен и отвечает');
      console.log(`   📍 URL: http://localhost:3001`);
      console.log(`   📊 Статус: ${JSON.stringify(data)}`);
   } else {
      console.log(`   ❌ WebSocket сервер отвечает с ошибкой: ${response.status}`);
   }
} catch (error) {
   console.log('   ❌ WebSocket сервер не запущен или недоступен');
   console.log(`   🔍 Ошибка: ${error.message}`);
}

// 2. Проверка открытых портов
console.log('\n2️⃣  Проверка открытых портов:\n');
try {
   const result = execSync('netstat -tlnp 2>/dev/null | grep LISTEN | grep -E ":(80|8888|8889|3001|5173)" || ss -tlnp 2>/dev/null | grep LISTEN | grep -E ":(80|8888|8889|3001|5173)"', {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
   });
   const lines = result.trim().split('\n');
   if (lines.length > 0) {
      console.log('   Открытые порты:');
      lines.forEach(line => {
         const portMatch = line.match(/:(\d+)/);
         if (portMatch) {
            const port = portMatch[1];
            let service = '';
            if (port === '80') service = ' (HTTP/Pixel Streaming?)';
            if (port === '3001') service = ' (WebSocket сервер)';
            if (port === '5173') service = ' (Vite dev server)';
            if (port === '8888' || port === '8889') service = ' (Pixel Streaming?)';
            console.log(`   ✅ Порт ${port}${service}`);
         }
      });
   } else {
      console.log('   ⚠️  Не найдено открытых портов 80, 8888, 8889, 3001, 5173');
   }
} catch (error) {
   console.log('   ⚠️  Не удалось проверить порты:', error.message);
}

// 3. Проверка Pixel Streaming на разных портах
console.log('\n3️⃣  Проверка Pixel Streaming сервера:\n');

const host = '176.97.78.210';
const portsToCheck = [80, 8888, 8889, 8080];

for (const port of portsToCheck) {
   try {
      const url = port === 80 ? `http://${host}/?StreamerId=DefaultStreamer` : `http://${host}:${port}/?StreamerId=DefaultStreamer`;
      console.log(`   Проверка порта ${port}...`);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      const response = await fetch(url, {
         method: 'GET',
         signal: controller.signal,
         headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; DiagnosticTool/1.0)',
         },
      });

      clearTimeout(timeoutId);

      if (response.ok) {
         const text = await response.text();
         const contentType = response.headers.get('content-type') || '';

         const hasPixelStreaming =
            text.includes('Streamer ID') ||
            text.includes('StreamerId') ||
            text.toLowerCase().includes('pixelstreaming') ||
            text.includes('Unreal Engine');

         if (hasPixelStreaming) {
            console.log(`      ✅ Pixel Streaming найден на порту ${port}!`);
         } else if (contentType.includes('text/html')) {
            console.log(`      ⚠️  HTML сервер найден на порту ${port} (возможно, не Pixel Streaming)`);
         } else {
            console.log(`      ℹ️  Сервер отвечает на порту ${port} (${response.status})`);
         }
      } else {
         console.log(`      ❌ Порт ${port} недоступен (${response.status})`);
      }
   } catch (error) {
      if (error.name === 'AbortError') {
         console.log(`      ⏱️  Таймаут при проверке порта ${port}`);
      } else {
         console.log(`      ❌ Порт ${port} недоступен: ${error.message}`);
      }
   }
}

// 4. Проверка переменных окружения
console.log('\n4️⃣  Проверка переменных окружения:\n');
const envVars = ['STREAM_SERVER_HOST', 'STREAM_SERVER_PORT', 'STREAM_SERVER_PROTOCOL'];
envVars.forEach(varName => {
   const value = process.env[varName];
   if (value) {
      console.log(`   ✅ ${varName}=${value}`);
   } else {
      console.log(`   ⚠️  ${varName} не установлена (будет использован auto-detect)`);
   }
});

// 5. Проверка логов WebSocket сервера
console.log('\n5️⃣  Проверка последних записей в логах WebSocket сервера:\n');
try {
   const logContent = execSync('tail -n 20 server.log 2>/dev/null || echo "Лог файл не найден"', {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
   });

   if (logContent && !logContent.includes('не найден')) {
      console.log('   Последние записи из server.log:');
      const lines = logContent.trim().split('\n').slice(-10);
      lines.forEach(line => {
         if (line.includes('[Proxy]')) {
            console.log(`   ${line.substring(0, 100)}...`);
         }
      });
   } else {
      console.log('   ℹ️  Лог файл пуст или не существует');
   }
} catch (error) {
   console.log('   ⚠️  Не удалось прочитать логи:', error.message);
}

// 6. Рекомендации
console.log('\n' + '='.repeat(60));
console.log('\n💡 Рекомендации:\n');

console.log('Если Pixel Streaming найден на порту X (не 80):');
console.log('   1. Создайте файл .env:');
console.log('      nano .env');
console.log('   2. Добавьте:');
console.log('      STREAM_SERVER_HOST=176.97.78.210');
console.log('      STREAM_SERVER_PORT=X');
console.log('      STREAM_SERVER_PROTOCOL=http');
console.log('   3. Перезапустите WebSocket сервер:');
console.log('      npm run server:stop');
console.log('      npm run server:bg');

console.log('\nДля проверки WebSocket сервера:');
console.log('   curl http://localhost:3001/health');

console.log('\nДля проверки Pixel Streaming:');
console.log('   curl http://176.97.78.210:PORT/?StreamerId=DefaultStreamer');

console.log('\nДля просмотра логов WebSocket сервера:');
console.log('   tail -f server.log');

console.log('\n' + '='.repeat(60));

