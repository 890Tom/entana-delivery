import { constants } from "node:os";

// Known debt: packages/database/tests/support/interrupt-cleanup.ts repeats this file (neither
// package can import the test support of the other).

const SIGNALS = ["SIGINT", "SIGTERM"] as const;
const CLEANUP_TIMEOUT_MS = 5000;

/**
 * Runs `cleanUp` when the process is interrupted by SIGINT or SIGTERM (turbo sends them to the
 * sibling tasks when one fails), then exits with the conventional code 128 + the signal number.
 * Returns a function that removes the handlers: call it in the normal teardown.
 *
 * Vitest answers the same signals by setting the exit code and calling `process.exit()` one
 * millisecond later, without running the teardown of a global setup. Waiting for an asynchronous
 * cleanup therefore needs `process.exit` to be held back, for at most CLEANUP_TIMEOUT_MS, and
 * restored before the real exit. A failing or slow cleanup never changes the exit code; it only
 * leaves one fixed line naming the database (`databaseName` matches test_ and lowercase hex).
 */
export function cleanUpOnSignal(cleanUp: () => Promise<void>, databaseName: string): () => void {
  const exitDescriptor = Object.getOwnPropertyDescriptor(process, "exit");

  const removeHandlers = (): void => {
    for (const signal of SIGNALS) {
      process.off(signal, onSignal);
    }
  };

  const holdBackExit = (): void => {
    if (exitDescriptor !== undefined) {
      Object.defineProperty(process, "exit", { ...exitDescriptor, value: () => undefined });
    }
  };

  const finish = async (exitCode: number): Promise<void> => {
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<boolean>((resolve) => {
      timer = setTimeout(() => {
        resolve(false);
      }, CLEANUP_TIMEOUT_MS);
    });
    // The cleanup error is dropped on purpose: it can quote the connection string.
    const isCleaned = await Promise.race([
      cleanUp().then(
        () => true,
        () => false,
      ),
      timeout,
    ]);
    clearTimeout(timer);
    if (!isCleaned) {
      process.stderr.write(`Interrupted: ${databaseName} may not have been dropped.\n`);
    }
    if (exitDescriptor !== undefined) {
      Object.defineProperty(process, "exit", exitDescriptor);
    }
    process.exit(exitCode);
  };

  function onSignal(signal: NodeJS.Signals): void {
    removeHandlers();
    holdBackExit();
    void finish(128 + constants.signals[signal]);
  }

  for (const signal of SIGNALS) {
    process.once(signal, onSignal);
  }
  return removeHandlers;
}
