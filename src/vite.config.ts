import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  vite: {
    server: {
      port: 6060,
      strictPort: true,
      host: "0.0.0.0",
      proxy: {
        // Proxy WebSocket requests from /forge-backend-ws to the Rust backend
        "/forge-backend-ws": {
          // Changed proxy path here
          target: "ws://127.0.0.1:3030/ws", // Target remains the full backend WS path
          ws: true,
          changeOrigin: true,
        },
      },
    },
  },
  tanstackStart: {
    server: { entry: "server" },
  },
});
