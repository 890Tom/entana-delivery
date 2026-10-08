import swc from "unplugin-swc";
import { defineConfig } from "vitest/config";
import { coverageSettings } from "./vitest.coverage.js";

// `pnpm test:coverage:api` runs the unit tests and the integration tests as two partial runs, then
// merges their reports and applies the floors to the merged report. A partial run executes only a
// part of the code, so it is never judged alone: `pnpm test:coverage` (no database, the quality
// job) runs the unit part only, without the floor, and the `integration` job applies the floor.
const isPartialRun = process.env.COVERAGE_PART === "1";

export default defineConfig({
  // Vitest's own transformer does not emit decorator metadata, which Nest's dependency injection
  // reads at runtime. SWC does (see .swcrc): this is the setup of the Nest documentation.
  plugins: [swc.vite()],
  test: {
    include: ["src/**/*.test.ts", "tests/e2e/**/*.test.ts"],
    coverage: isPartialRun
      ? { ...coverageSettings, reporter: ["json"] }
      : {
          ...coverageSettings,
          thresholds: { lines: 90, functions: 90, branches: 90, statements: 90 },
        },
  },
});
