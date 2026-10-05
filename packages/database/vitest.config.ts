import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts", "seed/**/*.test.ts"],
    // Integration tests need PostgreSQL: they run with `pnpm test:integration`.
    exclude: [...configDefaults.exclude, "src/**/*.integration.test.ts"],
  },
});
