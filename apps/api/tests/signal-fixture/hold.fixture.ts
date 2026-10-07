import { inject, it } from "vitest";

// Longer than every wait of run-interrupted-suite.ts, so the run is still open when the signal
// arrives, however slow the machine is.
const HOLD_MS = 60_000;
const HOLD_TIMEOUT_MS = 70_000;

// Run only by tests/integration/signal-cleanup.integration.test.ts, in a child process: it tells
// the parent which database this run created, then holds the run open so a signal can interrupt it.
it(
  "holds the run open",
  async () => {
    process.stdout.write(`FIXTURE_DATABASE=${inject("throwawayDatabase")}\n`);
    await new Promise((resolve) => setTimeout(resolve, HOLD_MS));
  },
  HOLD_TIMEOUT_MS,
);
