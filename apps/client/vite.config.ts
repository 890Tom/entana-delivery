import { existsSync } from "node:fs";
import { resolve } from "node:path";

import react from "@vitejs/plugin-react";
import { defineConfig, type Connect, type Plugin } from "vite";

const THEME_FILE = "theme.local.css";

// The private theme is git-ignored, so the link tag of index.html must not fail when it is
// absent. The build then emits an empty stylesheet in its place (a deployment replaces it with
// its own), and the dev server answers an empty one. `vite preview` serves the built file.
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

function hasPrivateTheme(root: string): boolean {
  return existsSync(resolve(root, "public", THEME_FILE));
}

function themeFallback(): Plugin {
  let root = "";
  return {
    name: "empty-theme-fallback",
    configResolved(config) {
      root = config.root;
    },
    configureServer(server) {
      server.middlewares.use(emptyThemeFallback(resolve(server.config.root, "public")));
    },
    generateBundle() {
      if (!hasPrivateTheme(root)) {
        this.emitFile({ type: "asset", fileName: THEME_FILE, source: "" });
      }
    },
  };
}

// The dev server keeps Vite's default host (localhost only). `server.proxy` is read by
// `vite dev` only: `vite build` and `vite preview` ignore it, so no proxy reaches production.
export default defineConfig({
  plugins: [react(), themeFallback()],
  server: {
    proxy: { "/api": "http://127.0.0.1:3000" },
  },
});
