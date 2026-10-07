import { spawn } from "node:child_process";
import type { ChildProcess } from "node:child_process";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

// Known debt: packages/database/tests/support/run-interrupted-suite.ts repeats this file.

const SUITE_DIRECTORY = fileURLToPath(new URL("../../../", import.meta.url));
// The line ends with a newline: a chunk that stops in the middle of the name cannot match.
const DATABASE_LINE = /FIXTURE_DATABASE=(test_[0-9a-f]+)\n/;
const WAIT_MS = 30_000;

export interface InterruptedRun {
  /** The exact database the child run created. */
  readonly database: string;
  /** Exit code of the child once the signal was sent. */
  readonly exitCode: number | null;
}

// The child is a Vitest of its own: it must not believe it runs inside this one.
function childEnvironment(): NodeJS.ProcessEnv {
  return Object.fromEntries(
    Object.entries(process.env).filter(([name]) => !name.startsWith("VITEST")),
  );
}

// The messages say what happened, never what the child printed: its output stays out of failures.
function waitForDatabaseName(child: ChildProcess, exited: Promise<number | null>): Promise<string> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error("The child run did not report its database in time."));
    }, WAIT_MS);
    let output = "";
    child.stdout?.on("data", (chunk: Buffer) => {
      output += chunk.toString();
      const database = DATABASE_LINE.exec(output)?.[1];
      if (database !== undefined) {
        clearTimeout(timer);
        resolve(database);
      }
    });
    void exited.then((code) => {
      clearTimeout(timer);
      reject(
        new Error(`The child run exited (code ${String(code)}) before reporting its database.`),
      );
    });
  });
}

async function waitForExitAfterSignal(exited: Promise<number | null>): Promise<number | null> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      reject(new Error("The child run did not exit within the wait after the signal."));
    }, WAIT_MS);
  });
  try {
    return await Promise.race([exited, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Starts the fixture suite with the real global setup. Once it reports its database,
 * `whileRunning` is called (the database exists at that moment), then the signal is sent and the
 * exit awaited. The child never outlives the call.
 */
export async function runSuiteInterruptedBy(
  signal: NodeJS.Signals,
  whileRunning: (database: string) => Promise<void>,
): Promise<InterruptedRun> {
  const entry = join(SUITE_DIRECTORY, "node_modules/vitest/vitest.mjs");
  const child = spawn(
    process.execPath,
    [entry, "run", "--config", "vitest.signal-fixture.config.ts"],
    { cwd: SUITE_DIRECTORY, env: childEnvironment(), stdio: ["ignore", "pipe", "ignore"] },
  );
  const exited = new Promise<number | null>((resolve) => {
    child.once("exit", resolve);
  });
  try {
    const database = await waitForDatabaseName(child, exited);
    await whileRunning(database);
    child.kill(signal);
    return { database, exitCode: await waitForExitAfterSignal(exited) };
  } finally {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill("SIGKILL");
    }
  }
}
