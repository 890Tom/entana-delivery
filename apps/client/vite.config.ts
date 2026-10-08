import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// The dev server keeps Vite's default host (localhost only). `server.proxy` is read by
// `vite dev` only: `vite build` and `vite preview` ignore it, so no proxy reaches production.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: { "/api": "http://127.0.0.1:3000" },
  },
});
