// Конфигурация Vagon Streams
export const vagonConfig = {
   apiKey: import.meta.env.VITE_VAGON_API_KEY || "30d90de5-a4a5-4df2-815a-aed8968e5c5a",
   secretKey: import.meta.env.VITE_VAGON_SECRET_KEY || "9dc488100902461689aeb64b128f014d",
   appId: import.meta.env.VITE_VAGON_APP_ID || "18534",
   defaultStreamId: "3dbfd836-c78a-4783-9e04-8944044d5dff",
   apiBaseUrl: "https://api.vagon.io",
};

