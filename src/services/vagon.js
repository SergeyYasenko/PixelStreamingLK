// Сервис для работы с Vagon Streams API
import { vagonConfig } from "@/config/vagon";

/**
 * Получить URL для iframe Vagon Streams
 * @param {string} streamId - ID стрима
 * @returns {string} URL для iframe
 */
export function getVagonStreamUrl(streamId) {
   if (!streamId) {
      return `https://streams.vagon.io/streams/${vagonConfig.defaultStreamId}`;
   }

   // Если это уже полный URL, возвращаем как есть
   if (streamId.includes("streams.vagon.io") || streamId.includes("vagon.io")) {
      return streamId;
   }

   // Если это UUID, формируем полный URL
   const uuidRegex =
      /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
   if (uuidRegex.test(streamId.trim())) {
      return `https://streams.vagon.io/streams/${streamId.trim()}`;
   }

   // Если это другой формат, возвращаем как есть
   return streamId;
}


