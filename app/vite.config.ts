import { defineConfig } from "vitest/config";
import vue from "@vitejs/plugin-vue";

// Tauri serves the dev page from this port (see src-tauri/tauri.conf.json).
export default defineConfig({
  plugins: [vue()],
  clearScreen: false,
  server: { port: 1430, strictPort: true },
  build: { target: "safari16", outDir: "dist", emptyOutDir: true },
  test: { environment: "happy-dom", include: ["src/**/*.test.ts"] },
});
