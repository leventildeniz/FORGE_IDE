import { defineConfig } from "vite";
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [
    tanstackStart({ server: { entry: "src/server.ts" } }),
    react(),
    tailwindcss(),
    tsconfigPaths(),
  ],
  server: {
    port: 6060,
    strictPort: true,
    host: "0.0.0.0",
    proxy: {
      // Proxy WebSocket requests from /forge-backend-ws to the Rust backend
      "/forge-backend-ws": {
        target: "ws://localhost:3030/ws",
        ws: true,
        changeOrigin: true,
      },
    },
  },
});
