import { existsSync } from "node:fs";
import { resolve } from "node:path";

import react from "@vitejs/plugin-react";
import { defineConfig, type Connect, type Plugin } from "vite";

const THEME_FILE = "theme.local.css";

// The private theme is git-ignored, so the link tag of index.html must not fail when it is
// absent: the dev and preview servers then answer an empty stylesheet. A production server must
// do the same (see the deployment notes).
function emptyThemeFallback(directory: string): Connect.NextHandleFunction {
  return (request, response, next) => {
    const isThemeRequest = request.url?.split("?")[0] === `/${THEME_FILE}`;
    if (!isThemeRequest || existsSync(resolve(directory, THEME_FILE))) {
      next();
      return;
    }
    response.setHeader("Content-Type", "text/css");
    response.end("");
  };
}

const themeFallback: Plugin = {
  name: "empty-theme-fallback",
  configureServer(server) {
    server.middlewares.use(emptyThemeFallback(resolve(server.config.root, "public")));
  },
  configurePreviewServer(server) {
    server.middlewares.use(
      emptyThemeFallback(resolve(server.config.root, server.config.build.outDir)),
    );
  },
};

// The dev server keeps Vite's default host (localhost only). `server.proxy` is read by
// `vite dev` only: `vite build` and `vite preview` ignore it, so no proxy reaches production.
export default defineConfig({
  plugins: [react(), themeFallback],
  server: {
    proxy: { "/api": "http://127.0.0.1:3000" },
  },
});
