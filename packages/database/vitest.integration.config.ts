import { defineConfig } from "vitest/config";

// These tests need a running PostgreSQL (`pnpm db:up`). `pnpm test` never runs them.
export default defineConfig({
  test: {
    include: ["tests/integration/**/*.test.ts"],
    globalSetup: ["tests/support/global-setup.ts"],
    // One shared temporary schema, and rows such as shop_setting(id = 1) cannot coexist.
    fileParallelism: false,
  },
});
