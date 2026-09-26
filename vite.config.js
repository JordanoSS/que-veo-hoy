import { defineConfig } from "vite";

// Vite sirve el frontend con HMR; Wrangler ejecuta Pages Functions en :8788.
export default defineConfig({
  server: {
    host: "127.0.0.1",
    proxy: { "/api": "http://127.0.0.1:8788" }
  }
});
