import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/auth": { target: "http://127.0.0.1:4000", changeOrigin: true },
      "/user": { target: "http://127.0.0.1:4000", changeOrigin: true },
      "/face": { target: "http://127.0.0.1:4000", changeOrigin: true },
      "/lookup": { target: "http://127.0.0.1:4000", changeOrigin: true },
      "/identity": { target: "http://127.0.0.1:4000", changeOrigin: true },
      "/payment": { target: "http://127.0.0.1:4000", changeOrigin: true },
      "/demo": { target: "http://127.0.0.1:4000", changeOrigin: true },
      "/health": { target: "http://127.0.0.1:4000", changeOrigin: true },
    },
  },
});
