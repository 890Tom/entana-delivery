import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// No `server` option on purpose: the dev and preview servers keep Vite's default, localhost only.
export default defineConfig({
  plugins: [react()],
});
