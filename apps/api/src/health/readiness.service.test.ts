import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ServiceNotReadyError } from "../errors/service-not-ready-error.js";
import { ReadinessService } from "./readiness.service.js";
import type { ReadinessDatabase, ReadinessLogger } from "./readiness.service.js";

const TIMEOUT_MS = 2000;

// The database and the logger are external boundaries: the stubs stand in for them, and the
// end-to-end tests exercise the real client against real sockets.
function buildDatabase(query: () => Promise<unknown>): ReadinessDatabase {
  return { $queryRaw: query };
}

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

describe("ReadinessService", () => {
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

  it("answers ready when the database answers", async () => {
    const { logger } = buildLogger();
    const service = new ReadinessService(
      buildDatabase(() => Promise.resolve([{ ok: 1 }])),
      TIMEOUT_MS,
      logger,
    );

    await expect(service.check()).resolves.toEqual({ status: "ready" });
  });

  it("logs nothing when the database answers", async () => {
    const { logger, warn } = buildLogger();
    const service = new ReadinessService(
      buildDatabase(() => Promise.resolve([])),
      TIMEOUT_MS,
      logger,
    );

    await service.check();

    expect(warn).not.toHaveBeenCalled();
  });

  it("clears its timer after a success", async () => {
    const { logger } = buildLogger();
    const service = new ReadinessService(
      buildDatabase(() => Promise.resolve([])),
      TIMEOUT_MS,
      logger,
    );

    await service.check();

    expect(vi.getTimerCount()).toBe(0);
  });

  it("clears its timer after a failure", async () => {
    const { logger } = buildLogger();
    const service = new ReadinessService(
      buildDatabase(() => Promise.reject(new Error("down"))),
      TIMEOUT_MS,
      logger,
    );

    await captureFailure(service.check());

    expect(vi.getTimerCount()).toBe(0);
  });

  it("refuses with a ServiceNotReadyError when the query fails", async () => {
    const { logger } = buildLogger();
    const service = new ReadinessService(
      buildDatabase(() => Promise.reject(new Error("relation does not exist"))),
      TIMEOUT_MS,
      logger,
    );

    expect(await captureFailure(service.check())).toBeInstanceOf(ServiceNotReadyError);
  });

  it("throws an error that carries nothing from the failure", async () => {
    const { logger } = buildLogger();
    const failure = Object.assign(new Error("password authentication failed for user admin"), {
      code: "28P01",
    });
    const service = new ReadinessService(
      buildDatabase(() => Promise.reject(failure)),
      TIMEOUT_MS,
      logger,
    );

    const thrown = await captureFailure(service.check());

    expect(thrown).toBeInstanceOf(ServiceNotReadyError);
    expect(thrown).toMatchObject({ message: "The service is not ready." });
    expect(thrown).not.toHaveProperty("cause");
  });

  it("gives up after the timeout when the database never answers", async () => {
    const { logger } = buildLogger();
    const service = new ReadinessService(
      buildDatabase(() => new Promise<never>(() => undefined)),
      TIMEOUT_MS,
      logger,
    );

    const outcome = captureFailure(service.check());
    await vi.advanceTimersByTimeAsync(TIMEOUT_MS);

    expect(await outcome).toBeInstanceOf(ServiceNotReadyError);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("does not give up before the timeout", async () => {
    const { logger, warn } = buildLogger();
    const service = new ReadinessService(
      buildDatabase(() => new Promise<never>(() => undefined)),
      TIMEOUT_MS,
      logger,
    );

    void captureFailure(service.check());
    await vi.advanceTimersByTimeAsync(TIMEOUT_MS - 1);

    expect(warn).not.toHaveBeenCalled();
  });

  it("logs one warning with a fixed message and only the reason", async () => {
    const { logger, warn } = buildLogger();
    const failure = Object.assign(new Error("password authentication failed for user admin"), {
      code: "ECONNREFUSED",
    });
    const service = new ReadinessService(
      buildDatabase(() => Promise.reject(failure)),
      TIMEOUT_MS,
      logger,
    );

    await captureFailure(service.check());

    expect(warn).toHaveBeenCalledOnce();
    expect(warn).toHaveBeenCalledWith({ reason: "connection" }, "Readiness check failed.");
  });

  it("logs the reason timeout when the database never answers", async () => {
    const { logger, warn } = buildLogger();
    const service = new ReadinessService(
      buildDatabase(() => new Promise<never>(() => undefined)),
      TIMEOUT_MS,
      logger,
    );

    const outcome = captureFailure(service.check());
    await vi.advanceTimersByTimeAsync(TIMEOUT_MS);
    await outcome;

    expect(warn).toHaveBeenCalledWith({ reason: "timeout" }, "Readiness check failed.");
  });

  it("raises no unhandled rejection when the abandoned query fails after the timeout", async () => {
    let rejectQuery: (error: Error) => void = () => undefined;
    const { logger } = buildLogger();
    const service = new ReadinessService(
      buildDatabase(
        () =>
          new Promise<never>((_resolve, reject) => {
            rejectQuery = reject;
          }),
      ),
      TIMEOUT_MS,
      logger,
    );

    const outcome = captureFailure(service.check());
    await vi.advanceTimersByTimeAsync(TIMEOUT_MS);
    await outcome;
    rejectQuery(new Error("late failure"));
    vi.useRealTimers();
    await new Promise((resolve) => setImmediate(resolve));

    expect(unhandled).not.toHaveBeenCalled();
  });
});
