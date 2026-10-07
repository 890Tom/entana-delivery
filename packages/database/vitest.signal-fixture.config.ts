import { defineConfig } from "vitest/config";

// The suite of tests/signal-fixture, with the real global setup of the integration suite. It exists
// only to be interrupted by a signal in tests/integration/signal-cleanup.integration.test.ts.
export default defineConfig({
  test: {
    include: ["tests/signal-fixture/*.fixture.ts"],
    globalSetup: ["tests/support/global-setup.ts"],
  },
});
