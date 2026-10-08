import { defineConfig, mergeConfig } from "vitest/config";

import viteConfig from "./vite.config";

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: "jsdom",
      include: ["src/**/*.test.{ts,tsx}"],
      coverage: {
        provider: "v8",
        // Explicit, so that a source file without any test still counts as uncovered.
        include: ["src/**/*.{ts,tsx}"],
        // main.tsx only mounts the application into the page.
        exclude: ["src/**/*.test.{ts,tsx}", "src/main.tsx"],
        thresholds: {
          lines: 90,
          functions: 90,
          branches: 90,
          statements: 90,
        },
      },
    },
  }),
);
