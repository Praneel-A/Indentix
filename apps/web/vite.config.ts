import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(path.join(__dirname, "package.json"), "utf-8")) as { version: string };

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
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
      "/govid": { target: "http://127.0.0.1:4000", changeOrigin: true },
      "/onboarding": { target: "http://127.0.0.1:4000", changeOrigin: true },
      "/public/verify": { target: "http://127.0.0.1:4000", changeOrigin: true },
      "/demo": { target: "http://127.0.0.1:4000", changeOrigin: true },
      "/health": { target: "http://127.0.0.1:4000", changeOrigin: true },
    },
  },
});
