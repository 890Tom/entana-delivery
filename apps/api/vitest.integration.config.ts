import swc from "unplugin-swc";
import { defineConfig } from "vitest/config";

// These tests need a running PostgreSQL (`pnpm db:up`). `pnpm test` and `pnpm test:e2e` never run
// them: they sit in tests/integration, which the default configuration does not include.
export default defineConfig({
  // Same transformer as the default configuration: Nest's injection needs decorator metadata.
  plugins: [swc.vite()],
  test: {
    include: ["tests/integration/**/*.test.ts"],
    globalSetup: ["tests/integration/support/global-setup.ts"],
    // One shared throwaway database, created once for the whole run.
    fileParallelism: false,
  },
});
