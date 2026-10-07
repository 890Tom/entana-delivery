import { describe, expect, it } from "vitest";

import { prismaError, uniqueFailure } from "../tests/support/prisma-error-fixtures.ts";
import { classifyDatabaseError } from "./classify-database-error.ts";

// Shapes observed on 2026-10-07 (Prisma 7.10.0, @prisma/adapter-pg 7.10.0, pg 8.23.1, Node 24.21.0)
// when the connection to PostgreSQL fails. Values are fake; only the property names are real.
describe("classifyDatabaseError: connection failures observed with a host name", () => {
  // Host `localhost`, nothing listening: the code sits at the top, there is no driver error.
  const refused = { name: "PrismaClientKnownRequestError", code: "ECONNREFUSED", meta: {} };
  // A server that accepts the connection and closes it.
  const closed = prismaError("P1017", { kind: "ConnectionClosed" });
  // The same event for a raw query: the Prisma code is P2010, the driver kind is the same.
  const closedRaw = prismaError("P2010", { kind: "ConnectionClosed" });
  // A broken pipe on the same event (observed once in 200 runs): like ECONNREFUSED, a string code
  // on the error itself, with a meta that holds only the model name.
  const brokenPipe = {
    name: "PrismaClientKnownRequestError",
    code: "EPIPE",
    meta: { modelName: "customer" },
  };
  // A server shutdown during a query (SQLSTATE 57P01, admin_shutdown).
  const shutdown = prismaError("P2010", { kind: "postgres", originalCode: "57P01" });

  it.each([
    ["a refused connection (code ECONNREFUSED)", refused],
    ["a connection closed by the server (P1017, ConnectionClosed)", closed],
    ["a connection closed by the server, raw query (P2010, ConnectionClosed)", closedRaw],
    ["a broken pipe (code EPIPE)", brokenPipe],
    ["a server shutdown during a query (57P01)", shutdown],
  ])("gives connection for %s", (_description, error) => {
    expect(classifyDatabaseError(error)).toBe("connection");
  });

  describe.each(["ECONNREFUSED", "EPIPE"])("the %s code", (listed) => {
    it.each([
      ["a number", 111],
      ["an object", { value: listed }],
      ["an array", [listed]],
      ["an object that coerces to the code", { toString: () => listed }],
      ["the code in lower case", listed.toLowerCase()],
    ])("gives unknown when it is %s", (_description, code) => {
      expect(classifyDatabaseError({ code, meta: {} })).toBe("unknown");
    });
  });

  it("gives unknown for a code that is not listed", () => {
    expect(classifyDatabaseError({ code: "ECONNRESET", meta: {} })).toBe("unknown");
  });

  it.each([
    [
      "an Error whose message names the code",
      new Error("connect ECONNREFUSED db.example.invalid:5432"),
    ],
    [
      "a Prisma-like object whose message is the code",
      { name: "PrismaClientKnownRequestError", message: "ECONNREFUSED", meta: {} },
    ],
    ["a driver kind that is the code", prismaError("P2010", { kind: "ECONNREFUSED" })],
    ["an Error whose message names EPIPE", new Error("write EPIPE")],
  ])("gives unknown for text that merely contains a code: %s", (_description, error) => {
    expect(classifyDatabaseError(error)).toBe("unknown");
  });

  it.each([
    ["P1017 with a different kind", prismaError("P1017", { kind: "Other" })],
    ["P1017 with no driver error", prismaError("P1017")],
    [
      "P1017 with a kind that is not a string",
      prismaError("P1017", { kind: ["ConnectionClosed"] }),
    ],
    [
      "ConnectionClosed under a Prisma code never observed with it",
      prismaError("P9999", { kind: "ConnectionClosed" }),
    ],
    [
      "ConnectionClosed without a Prisma code",
      { meta: { driverAdapterError: { cause: { kind: "ConnectionClosed" } } } },
    ],
  ])("gives unknown for the pair rule: %s", (_description, error) => {
    expect(classifyDatabaseError(error)).toBe("unknown");
  });

  it("does not let ConnectionClosed override the kind of another listed Prisma code", () => {
    expect(classifyDatabaseError(prismaError("P2002", { kind: "ConnectionClosed" }))).toBe(
      "unique_violation",
    );
  });

  it.each([
    ["a number", 5701],
    ["an object", { value: "57P01" }],
    ["a SQLSTATE that was not observed (57P02)", "57P02"],
    ["a SQLSTATE that was not observed (57P03)", "57P03"],
  ])("gives unknown when the originalCode is %s", (_description, originalCode) => {
    expect(classifyDatabaseError(prismaError("P2010", { kind: "postgres", originalCode }))).toBe(
      "unknown",
    );
  });

  it.each([
    ["another Prisma code", prismaError("P2025", { kind: "postgres", originalCode: "57P01" })],
    ["no Prisma code", { meta: { driverAdapterError: { cause: { originalCode: "57P01" } } } }],
  ])("gives connection for 57P01 under %s", (_description, error) => {
    expect(classifyDatabaseError(error)).toBe("connection");
  });

  it.each([
    ["a refused connection", refused],
    ["a broken pipe", brokenPipe],
  ])("gives connection for %s found in a cause", (_description, inner) => {
    expect(classifyDatabaseError({ cause: inner })).toBe("connection");
  });

  it("lets an outer known error win over an inner broken pipe, and the reverse", () => {
    expect([
      classifyDatabaseError({ ...uniqueFailure, cause: brokenPipe }),
      classifyDatabaseError({ ...brokenPipe, cause: uniqueFailure }),
    ]).toEqual(["unique_violation", "connection"]);
  });

  it("lets an outer known error win over an inner refused connection", () => {
    const outer = { ...uniqueFailure, cause: refused };

    expect(classifyDatabaseError(outer)).toBe("unique_violation");
  });

  it("lets an outer refused connection win over an inner known error", () => {
    const outer = { ...refused, cause: uniqueFailure };

    expect(classifyDatabaseError(outer)).toBe("connection");
  });
});
