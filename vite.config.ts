import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The frontend talks to the thin backend proxy at :8787.
// In dev, Vite proxies /api to it so there are no CORS surprises.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:8787",
        changeOrigin: true,
      },
    },
  },
});
