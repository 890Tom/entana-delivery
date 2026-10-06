import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ServiceNotReadyError } from "../../errors/service-not-ready-error.js";
import { ReadinessService } from "./readiness.service.js";
import type { ReadinessDatabase, ReadinessLogger } from "./readiness.service.js";

const TIMEOUT_MS = 2000;

function buildLogger(): { logger: ReadinessLogger; warn: ReturnType<typeof vi.fn> } {
  const warn = vi.fn();
  return { logger: { warn }, warn };
}

async function captureFailure(promise: Promise<unknown>): Promise<unknown> {
  return promise.then(
    () => undefined,
    (error: unknown) => error,
  );
}

// A stub that counts the queries it receives and lets the test settle them when it chooses.
// It stands in for the database, an external boundary: what is under test is how many queries
// the service sends, which only a counter can tell.
interface ControlledDatabase {
  readonly database: ReadinessDatabase;
  queryCount(): number;
  succeed(): Promise<void>;
  fail(error: Error): Promise<void>;
}

function buildControlledDatabase(): ControlledDatabase {
  const pending: { resolve: () => void; reject: (error: Error) => void }[] = [];
  let count = 0;
  const settleOldest = async (settle: (entry: (typeof pending)[number]) => void): Promise<void> => {
    const entry = pending.shift();
    if (entry !== undefined) {
      settle(entry);
    }
    await vi.advanceTimersByTimeAsync(0);
  };
  return {
    database: {
      $queryRaw: () => {
        count += 1;
        return new Promise<unknown>((resolve, reject) => {
          pending.push({
            resolve: () => {
              resolve([]);
            },
            reject,
          });
        });
      },
    },
    queryCount: () => count,
    succeed: () =>
      settleOldest((entry) => {
        entry.resolve();
      }),
    fail: (error) =>
      settleOldest((entry) => {
        entry.reject(error);
      }),
  };
}

function checkTimes(service: ReadinessService, times: number): Promise<unknown>[] {
  return Array.from({ length: times }, () => captureFailure(service.check()));
}

// The `describe` below needs the same fake timers and unhandled-rejection listener as the other
// service tests.
const unhandled = vi.fn();

beforeEach(() => {
  vi.useFakeTimers();
  unhandled.mockClear();
  process.on("unhandledRejection", unhandled);
});
afterEach(() => {
  vi.useRealTimers();
  process.off("unhandledRejection", unhandled);
});

describe("ReadinessService, one query at a time", () => {
  const concurrentCalls = 10;

  function buildService(controlled: ControlledDatabase): {
    service: ReadinessService;
    warn: ReturnType<typeof vi.fn>;
  } {
    const { logger, warn } = buildLogger();
    return { service: new ReadinessService(controlled.database, TIMEOUT_MS, logger), warn };
  }

  async function expectCleanEnd(): Promise<void> {
    // Counted before the clock is swapped: installing fake timers again would forget them.
    const timersLeft = vi.getTimerCount();
    // A rejection that nobody handles is only reported on a later turn of the event loop.
    vi.useRealTimers();
    await new Promise((resolve) => setImmediate(resolve));
    vi.useFakeTimers();
    expect(unhandled).not.toHaveBeenCalled();
    expect(timersLeft).toBe(0);
  }

  it("sends one query for simultaneous calls, and all of them are ready", async () => {
    const controlled = buildControlledDatabase();
    const { service } = buildService(controlled);

    const calls = Array.from({ length: concurrentCalls }, () => service.check());
    await controlled.succeed();

    await expect(Promise.all(calls)).resolves.toEqual(
      Array.from({ length: concurrentCalls }, () => ({ status: "ready" })),
    );
    expect(controlled.queryCount()).toBe(1);
    await expectCleanEnd();
  });

  it("refuses every simultaneous call with the readiness error when the query fails", async () => {
    const controlled = buildControlledDatabase();
    const { service, warn } = buildService(controlled);

    const outcomes = checkTimes(service, concurrentCalls);
    await controlled.fail(new Error("down"));

    for (const outcome of await Promise.all(outcomes)) {
      expect(outcome).toBeInstanceOf(ServiceNotReadyError);
    }
    expect(controlled.queryCount()).toBe(1);
    // One failed query is one warning, not one per call that joined it.
    expect(warn).toHaveBeenCalledOnce();
    await expectCleanEnd();
  });

  it("sends a new query for the call that follows a successful one", async () => {
    const controlled = buildControlledDatabase();
    const { service } = buildService(controlled);
    const first = service.check();
    await controlled.succeed();
    await first;

    const second = service.check();
    await controlled.succeed();

    await expect(second).resolves.toEqual({ status: "ready" });
    expect(controlled.queryCount()).toBe(2);
    await expectCleanEnd();
  });

  it("sends a new query for the call that follows a failed one", async () => {
    const controlled = buildControlledDatabase();
    const { service } = buildService(controlled);
    const first = captureFailure(service.check());
    await controlled.fail(new Error("down"));
    await first;

    const second = service.check();
    await controlled.succeed();

    await expect(second).resolves.toEqual({ status: "ready" });
    expect(controlled.queryCount()).toBe(2);
    await expectCleanEnd();
  });

  it("sends no second query while a hung one is pending, and each call times out on its own", async () => {
    const controlled = buildControlledDatabase();
    const { service } = buildService(controlled);
    const first = captureFailure(service.check());
    await vi.advanceTimersByTimeAsync(TIMEOUT_MS);
    expect(await first).toBeInstanceOf(ServiceNotReadyError);

    // The first query has outlived the timeout of the first caller: later calls join it.
    const second = captureFailure(service.check());
    await vi.advanceTimersByTimeAsync(TIMEOUT_MS - 1);
    const third = captureFailure(service.check());
    let isSecondDone = false;
    void second.then(() => {
      isSecondDone = true;
    });
    await vi.advanceTimersByTimeAsync(0);
    expect(isSecondDone).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(await second).toBeInstanceOf(ServiceNotReadyError);
    await vi.advanceTimersByTimeAsync(TIMEOUT_MS - 1);
    expect(await third).toBeInstanceOf(ServiceNotReadyError);

    expect(controlled.queryCount()).toBe(1);
    await controlled.succeed();
    await expectCleanEnd();
  });

  it("sends exactly one new query once the hung one has settled", async () => {
    const controlled = buildControlledDatabase();
    const { service } = buildService(controlled);
    const first = captureFailure(service.check());
    await vi.advanceTimersByTimeAsync(TIMEOUT_MS);
    await first;
    await controlled.succeed();

    const next = Array.from({ length: concurrentCalls }, () => service.check());
    await controlled.succeed();

    await expect(Promise.all(next)).resolves.toHaveLength(concurrentCalls);
    expect(controlled.queryCount()).toBe(2);
    await expectCleanEnd();
  });

  it("logs the timeout once for a pending query, however many calls time out on it", async () => {
    const controlled = buildControlledDatabase();
    const { service, warn } = buildService(controlled);

    const outcomes = checkTimes(service, concurrentCalls);
    await vi.advanceTimersByTimeAsync(TIMEOUT_MS);
    await Promise.all(outcomes);
    const later = captureFailure(service.check());
    await vi.advanceTimersByTimeAsync(TIMEOUT_MS);
    await later;

    expect(warn).toHaveBeenCalledOnce();
    expect(warn).toHaveBeenCalledWith({ reason: "timeout" }, "Readiness check failed.");
    await controlled.succeed();
    await expectCleanEnd();
  });

  it("raises no unhandled rejection when the hung query fails after every call gave up", async () => {
    const controlled = buildControlledDatabase();
    const { service } = buildService(controlled);
    const outcome = captureFailure(service.check());
    await vi.advanceTimersByTimeAsync(TIMEOUT_MS);
    await outcome;

    await controlled.fail(new Error("late failure"));

    await expectCleanEnd();
  });

  it("refuses with the readiness error, and logs once, when the client throws at once", async () => {
    const { logger, warn } = buildLogger();
    const service = new ReadinessService(
      {
        $queryRaw: () => {
          throw Object.assign(new Error("client is closed"), { code: "ECONNRESET" });
        },
      },
      TIMEOUT_MS,
      logger,
    );

    expect(await captureFailure(service.check())).toBeInstanceOf(ServiceNotReadyError);
    expect(warn).toHaveBeenCalledOnce();
    expect(warn).toHaveBeenCalledWith({ reason: "connection" }, "Readiness check failed.");
    // The failed query is not kept: the next call starts a new one.
    expect(await captureFailure(service.check())).toBeInstanceOf(ServiceNotReadyError);
    expect(warn).toHaveBeenCalledTimes(2);
  });
});
