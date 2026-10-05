import { NotFoundException } from "@nestjs/common";
import { ExecutionContextHost } from "@nestjs/core/helpers/execution-context-host.js";
import { describe, expect, it, vi } from "vitest";
import { ProblemDetailsFilter } from "./problem-details.filter.js";

interface FakeResponse {
  statusCode: number | undefined;
  contentType: string | undefined;
  body: unknown;
  status(code: number): FakeResponse;
  type(value: string): FakeResponse;
  json(value: unknown): FakeResponse;
}

function buildResponse(): FakeResponse {
  const response: FakeResponse = {
    statusCode: undefined,
    contentType: undefined,
    body: undefined,
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

function handle(error: unknown, path = "/api/v1/things?page=2"): FakeResponse {
  const response = buildResponse();
  const host = new ExecutionContextHost([{ originalUrl: path }, response]);
  new ProblemDetailsFilter({ error: () => undefined }).catch(error, host);
  return response;
}

describe("ProblemDetailsFilter", () => {
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
      const logError = vi.fn<(message: string) => void>();
      const host = new ExecutionContextHost([{ originalUrl: "/x?token=abc" }, buildResponse()]);
      new ProblemDetailsFilter({ error: logError }).catch(error, host);
      expect(logError).toHaveBeenCalledOnce();
      return logError.mock.calls[0]?.[0] ?? "";
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
    const logError = vi.fn();
    const host = new ExecutionContextHost([{ originalUrl: "/x?token=abc" }, buildResponse()]);
    new ProblemDetailsFilter({ error: logError }).catch(new NotFoundException(), host);
    expect(logError).not.toHaveBeenCalled();
  });
});
