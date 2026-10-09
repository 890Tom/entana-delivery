import { NotFoundException } from "@nestjs/common";
import { ExecutionContextHost } from "@nestjs/core/helpers/execution-context-host.js";
import { DATABASE_ERROR_KINDS } from "@entana/database";
import { describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";
import { fixedDatabaseProblem } from "../../../tests/support/fixed-database-problems.js";
import { buildObservedDatabaseError } from "../../../tests/support/observed-database-errors.js";
import { ProblemDetailsFilter } from "./problem-details.filter.js";
import { ServiceNotReadyError } from "../../health/readiness/failure/service-not-ready-error.js";

interface FakeResponse {
  statusCode: number | undefined;
  contentType: string | undefined;
  headers: Record<string, string>;
  body: unknown;
  setHeader(name: string, value: string): FakeResponse;
  status(code: number): FakeResponse;
  type(value: string): FakeResponse;
  json(value: unknown): FakeResponse;
}

function buildResponse(headers: Record<string, string> = {}): FakeResponse {
  const response: FakeResponse = {
    statusCode: undefined,
    contentType: undefined,
    headers,
    body: undefined,
    setHeader(name, value) {
      response.headers[name] = value;
      return response;
    },
    status(code) {
      response.statusCode = code;
      return response;
    },
    type(value) {
      response.contentType = value;
      return response;
    },
    json(value) {
      response.body = value;
      return response;
    },
  };
  return response;
}

// Every level is a spy: a test can prove that exactly one line was written, at the right level.
function buildLogger(): { error: Mock; warn: Mock; log: Mock } {
  return { error: vi.fn(), warn: vi.fn(), log: vi.fn() };
}

function handle(
  error: unknown,
  path = "/api/v1/things?page=2",
  headers: Record<string, string> = {},
): FakeResponse {
  const response = buildResponse(headers);
  const host = new ExecutionContextHost([{ originalUrl: path }, response]);
  new ProblemDetailsFilter(buildLogger()).catch(error, host);
  return response;
}

describe("ProblemDetailsFilter", () => {
  it("never lets a shared cache keep an error answer, whatever the route set before it failed", () => {
    const response = handle(new NotFoundException("Nothing here"), "/api/v1/things", {
      "Cache-Control": "public, max-age=30",
    });

    expect(response.headers).toEqual({ "Cache-Control": "no-store" });
  });

  it("answers with the problem details media type and the status of the error", () => {
    const response = handle(new NotFoundException());
    expect(response.statusCode).toBe(404);
    expect(response.contentType).toBe("application/problem+json");
    // The query string is not part of the instance: it can hold personal data.
    expect(response.body).toMatchObject({ status: 404, instance: "/api/v1/things" });
  });

  it("never sends the message or the stack of an unknown error", () => {
    const response = handle(new Error("secret internal detail"));
    expect(response.statusCode).toBe(500);
    expect(JSON.stringify(response.body)).not.toContain("secret internal detail");
    expect(JSON.stringify(response.body)).not.toMatch(/\n\s+at /);
  });

  describe("log of an unknown error", () => {
    function logged(error: unknown): string {
      const logger = buildLogger();
      const host = new ExecutionContextHost([{ originalUrl: "/x?token=abc" }, buildResponse()]);
      new ProblemDetailsFilter(logger).catch(error, host);
      expect(logger.error).toHaveBeenCalledOnce();
      expect(logger.warn).not.toHaveBeenCalled();
      expect(logger.log).not.toHaveBeenCalled();
      return String(logger.error.mock.calls[0]?.[0] ?? "");
    }

    it("has the type of the error and its stack frames, to find the cause", () => {
      const message = logged(new TypeError("secret internal detail"));
      expect(message).toMatch(/^TypeError\n\s+at .+:\d+:\d+/);
    });

    it("never has the message of the error, which can hold personal data", () => {
      expect(logged(new Error("phone 0340000000 not found"))).not.toContain("0340000000");
    });

    it("says so when the thrown value is not an Error", () => {
      expect(logged("0340000000")).toBe("A value that is not an Error was thrown.");
    });

    it("has only the type when the error has no stack", () => {
      expect(logged(Object.assign(new RangeError("x"), { stack: undefined }))).toBe("RangeError");
    });
  });

  it("does not log an error caused by the client", () => {
    const logger = buildLogger();
    const host = new ExecutionContextHost([{ originalUrl: "/x?token=abc" }, buildResponse()]);
    new ProblemDetailsFilter(logger).catch(new NotFoundException(), host);
    expect(Object.values(logger).flatMap((spy) => spy.mock.calls)).toEqual([]);
  });

  it("does not log the service not being ready: the readiness check logged it already", () => {
    const logger = buildLogger();
    const host = new ExecutionContextHost([{ originalUrl: "/x" }, buildResponse()]);
    new ProblemDetailsFilter(logger).catch(new ServiceNotReadyError(), host);
    expect(Object.values(logger).flatMap((spy) => spy.mock.calls)).toEqual([]);
  });
});

describe("ProblemDetailsFilter: database failures", () => {
  const classified = DATABASE_ERROR_KINDS.filter((kind) => kind !== "unknown");
  const levelOf = {
    connection: "warn",
    timeout: "warn",
    unique_violation: "log",
    foreign_key_violation: "log",
    record_not_found: "log",
    check_violation: "error",
    not_null_violation: "error",
  } as const;

  function run(error: unknown): { logger: ReturnType<typeof buildLogger>; response: FakeResponse } {
    const logger = buildLogger();
    const response = buildResponse();
    const host = new ExecutionContextHost([{ originalUrl: "/x?phone=0340000000" }, response]);
    new ProblemDetailsFilter(logger).catch(error, host);
    return { logger, response };
  }

  it.each(classified)("answers %s with the whole fixed body", (kind) => {
    const { response } = run(buildObservedDatabaseError(kind));

    expect(response.contentType).toBe("application/problem+json");
    expect(response.statusCode).toBe(fixedDatabaseProblem(kind, "/x").status);
    expect(response.body).toEqual(fixedDatabaseProblem(kind, "/x"));
  });

  it.each(classified)("writes exactly one line for %s: fixed text, the kind as reason", (kind) => {
    const { logger } = run(buildObservedDatabaseError(kind));

    const calls = Object.entries(logger).flatMap(([level, spy]) =>
      spy.mock.calls.map((args) => ({ level, args })),
    );
    expect(calls).toEqual([
      { level: levelOf[kind], args: [{ reason: kind }, "Database operation failed."] },
    ]);
  });

  it("never logs the error, its text, its stack or its meta", () => {
    const error = Object.assign(new Error("phone 0340000000 is taken"), {
      code: "P2002",
      meta: { target: ["phone_e164"], driverAdapterError: { cause: { originalCode: "23505" } } },
    });

    const { logger } = run(error);

    const everythingLogged = JSON.stringify(Object.values(logger).flatMap((spy) => spy.mock.calls));
    expect(everythingLogged).not.toMatch(/0340000000|phone_e164|\bat\b .*:\d+|Error/);
  });

  it("keeps the existing single error line for an error classified unknown", () => {
    const { logger, response } = run(new TypeError("secret"));

    expect(response.statusCode).toBe(500);
    expect(logger.error).toHaveBeenCalledOnce();
    expect(logger.error.mock.calls[0]?.[0]).toMatch(/^TypeError\n\s+at /);
    expect(logger.warn).not.toHaveBeenCalled();
    expect(logger.log).not.toHaveBeenCalled();
  });
});
