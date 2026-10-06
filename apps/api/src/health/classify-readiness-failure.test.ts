import { describe, expect, it } from "vitest";
import { classifyReadinessFailure } from "./classify-readiness-failure.js";
import { ReadinessTimeoutError } from "./readiness-timeout-error.js";

function errorWithCode(code: string): Error {
  return Object.assign(new Error("message that must never be read"), { code });
}

describe("classifyReadinessFailure", () => {
  it("classifies our own timeout as a timeout", () => {
    expect(classifyReadinessFailure(new ReadinessTimeoutError())).toBe("timeout");
  });

  it.each([
    "ECONNREFUSED",
    "ENOTFOUND",
    "ETIMEDOUT",
    "ECONNRESET",
    "EHOSTUNREACH",
    "ENETUNREACH",
    "EPIPE",
  ])("classifies the socket error %s as a connection failure", (code) => {
    expect(classifyReadinessFailure(errorWithCode(code))).toBe("connection");
  });

  it.each(["P1001", "P1002", "P1008", "P1017"])(
    "classifies the Prisma connection code %s as a connection failure",
    (code) => {
      expect(classifyReadinessFailure(errorWithCode(code))).toBe("connection");
    },
  );

  // What Prisma 7 with the pg adapter really throws for a raw query: a P2010 whose meta holds the
  // driver error, itself caused by a plain object with a `kind` (checked against a closed port).
  function prismaRawQueryError(kind: string): Error {
    const driverError = new Error("DriverAdapterError", {
      cause: { kind, host: "db.internal", port: 5432 },
    });
    return Object.assign(new Error("Raw query failed."), {
      code: "P2010",
      meta: { driverAdapterError: driverError },
    });
  }

  it.each([
    "DatabaseNotReachable",
    "ConnectionClosed",
    "TlsConnectionError",
    "SocketTimeout",
    "TooManyConnections",
    "AuthenticationFailed",
  ])("classifies the driver failure %s, wrapped by Prisma, as a connection failure", (kind) => {
    expect(classifyReadinessFailure(prismaRawQueryError(kind))).toBe("connection");
  });

  it("classifies a driver failure that is not about the connection as a query failure", () => {
    expect(classifyReadinessFailure(prismaRawQueryError("TableDoesNotExist"))).toBe("query");
  });

  it("finds a connection failure inside an AggregateError (a host with several addresses)", () => {
    const error = new AggregateError([
      errorWithCode("ECONNREFUSED"),
      errorWithCode("ECONNREFUSED"),
    ]);
    expect(classifyReadinessFailure(error)).toBe("connection");
  });

  it("finds a connection failure in the cause of an error", () => {
    const error = new Error("wrapper", { cause: errorWithCode("ECONNREFUSED") });
    expect(classifyReadinessFailure(error)).toBe("connection");
  });

  it("classifies a database error that is not about the connection as a query failure", () => {
    expect(classifyReadinessFailure(errorWithCode("42P01"))).toBe("query");
  });

  it.each([
    ["an error without a code", new Error("boom")],
    ["a string", "ECONNREFUSED"],
    ["undefined", undefined],
    ["null", null],
  ])("classifies %s as a query failure", (_label, error) => {
    expect(classifyReadinessFailure(error)).toBe("query");
  });

  it("never reads the message: a message that mentions a refused connection is not enough", () => {
    expect(classifyReadinessFailure(new Error("connect ECONNREFUSED 10.0.0.5:5432"))).toBe("query");
  });

  it("stops on an error whose cause loops back to itself", () => {
    const error = new Error("loop");
    error.cause = error;
    expect(classifyReadinessFailure(error)).toBe("query");
  });
});
