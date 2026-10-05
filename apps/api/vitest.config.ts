import swc from "unplugin-swc";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // Vitest's own transformer does not emit decorator metadata, which Nest's dependency injection
  // reads at runtime. SWC does (see .swcrc): this is the setup of the Nest documentation.
  plugins: [swc.vite()],
  test: {
    include: ["src/**/*.test.ts", "tests/e2e/**/*.test.ts"],
    coverage: {
      provider: "v8",
      // Unit and end-to-end tests run together for coverage: wiring files (modules, controllers,
      // configureApplication) are exercised by booting the real application.
      include: ["src/**/*.ts"],
      // main.ts only reads process.env and starts listening: the tests boot the application
      // through createApplication instead.
      exclude: ["src/**/*.test.ts", "src/main.ts"],
      thresholds: { lines: 90, functions: 90, branches: 90, statements: 90 },
    },
  },
});
