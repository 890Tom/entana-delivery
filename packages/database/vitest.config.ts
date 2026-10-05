import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts", "seed/**/*.test.ts", "tests/**/*.test.ts"],
    // Integration tests need PostgreSQL: they run with `pnpm test:integration`.
    exclude: [...configDefaults.exclude, "tests/integration/**"],
    coverage: {
      provider: "v8",
      // Domain code only. The seed scripts and the generated client talk to a database: the
      // integration tests and a real seed run cover them, not unit tests.
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.test.ts", "src/generated/**"],
      // A floor, not a target.
      thresholds: { lines: 90, functions: 90, branches: 90, statements: 90 },
    },
  },
});
