import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  vite: {
    server: {
      port: 6060,
      strictPort: true,
      host: "0.0.0.0",
      // Re-enable HMR by removing the hmr: false setting
      proxy: {
        // Proxy WebSocket requests from /forge-backend-ws to the Rust backend
        "/forge-backend-ws": {
          target: "ws://localhost:3030/ws", // This target resolved the ETIMEDOUT error with Vite proxy
          ws: true,
          changeOrigin: true, // Re-enable changeOrigin as it's standard for proxies
          // Removed custom configure function for proxy events to simplify and avoid conflicts
        },
      },
    },
  },
  tanstackStart: {
    server: { entry: "server" },
  },
});
