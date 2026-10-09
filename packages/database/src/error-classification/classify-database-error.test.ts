import { describe, expect, it } from "vitest";

import {
  prismaError,
  uniqueFailure,
} from "../../tests/support/database-errors/prisma-error-fixtures.ts";
import { classifyDatabaseError, DATABASE_ERROR_KINDS } from "./classify-database-error.ts";

const connectionFailure = prismaError("P2010", { kind: "DatabaseNotReachable" });
const poolTimeoutText = "Connection terminated due to connection timeout";

function nestCause(depth: number, innermost: unknown): unknown {
  let error = innermost;
  for (let level = 0; level < depth; level += 1) {
    error = { cause: error };
  }
  return error;
}

describe("DATABASE_ERROR_KINDS", () => {
  it("is the closed list of kinds", () => {
    expect(DATABASE_ERROR_KINDS).toEqual([
      "unique_violation",
      "foreign_key_violation",
      "check_violation",
      "not_null_violation",
      "record_not_found",
      "connection",
      "timeout",
      "unknown",
    ]);
  });
});

describe("classifyDatabaseError: what it receives is not an error it knows", () => {
  it.each([
    undefined,
    null,
    "",
    "P2002",
    "23505",
    0,
    42,
    true,
    10n,
    Symbol("P2002"),
    () => "P2002",
    [],
    {},
  ])("gives unknown for %#", (input) => {
    expect(classifyDatabaseError(input)).toBe("unknown");
  });

  it("gives unknown for an Error without a code", () => {
    expect(classifyDatabaseError(new Error("something broke"))).toBe("unknown");
  });

  it("gives unknown for a code it does not list", () => {
    expect(classifyDatabaseError(prismaError("P9999"))).toBe("unknown");
  });
});

describe("classifyDatabaseError: observed Prisma errors", () => {
  it.each([
    ["unique_violation", uniqueFailure],
    [
      "foreign_key_violation",
      prismaError("P2003", { kind: "ForeignKeyConstraintViolation", originalCode: "23503" }),
    ],
    [
      "check_violation",
      prismaError("P2039", { kind: "postgres", originalCode: "23514", code: "23514" }),
    ],
    [
      "not_null_violation",
      prismaError("P2010", { kind: "NullConstraintViolation", originalCode: "23502" }),
    ],
    ["record_not_found", prismaError("P2025")],
    ["connection", connectionFailure],
  ] as const)("gives %s", (kind, error) => {
    expect(classifyDatabaseError(error)).toBe(kind);
  });

  it("gives unknown for P2010 with an originalCode and a kind it does not list", () => {
    expect(
      classifyDatabaseError(prismaError("P2010", { kind: "Other", originalCode: "99999" })),
    ).toBe("unknown");
  });

  it("gives unknown for P2010 without a driver error", () => {
    expect(classifyDatabaseError(prismaError("P2010"))).toBe("unknown");
  });
});

describe("classifyDatabaseError: a code counts only when it is a string", () => {
  it.each([
    ["a number", 2002],
    ["a missing code", undefined],
    ["an object", { value: "P2002" }],
    ["an array", ["P2002"]],
    ["null", null],
    ["an object that coerces to a listed code", { toString: () => "P2002" }],
  ])("ignores a Prisma code that is %s", (_description, code) => {
    expect(classifyDatabaseError({ code })).toBe("unknown");
  });

  it.each([
    ["a number", 23505],
    ["an object", { value: "23505" }],
  ])("ignores an originalCode that is %s", (_description, originalCode) => {
    expect(classifyDatabaseError(prismaError("P2010", { originalCode }))).toBe("unknown");
  });

  it("ignores a kind that is not a string", () => {
    expect(classifyDatabaseError(prismaError("P2010", { kind: ["DatabaseNotReachable"] }))).toBe(
      "unknown",
    );
  });

  it("reads meta only when it is an object", () => {
    expect(classifyDatabaseError({ code: "P2010", meta: "DatabaseNotReachable" })).toBe("unknown");
  });
});

describe("classifyDatabaseError: the pool connection timeout", () => {
  it("gives timeout for the observed error of pg", () => {
    expect(classifyDatabaseError(new Error(poolTimeoutText))).toBe("timeout");
  });

  it("finds it in a cause", () => {
    const wrapped = new Error("wrapper", { cause: new Error(poolTimeoutText) });

    expect(classifyDatabaseError(wrapped)).toBe("timeout");
  });

  it.each([
    [
      "an Error that carries a code",
      Object.assign(new Error(poolTimeoutText), { code: "ETIMEDOUT" }),
    ],
    ["a plain object", { message: poolTimeoutText }],
    ["a string", poolTimeoutText],
    ["a different text", new Error("Connection terminated unexpectedly")],
    ["the text with more around it", new Error(`${poolTimeoutText} (while testing)`)],
    ["a text that is not a string", Object.assign(new Error("x"), { message: [poolTimeoutText] })],
  ])("does not give timeout for %s", (_description, error) => {
    expect(classifyDatabaseError(error)).toBe("unknown");
  });

  it("is tried after the structural checks", () => {
    const structural = Object.assign(new Error(poolTimeoutText), { cause: uniqueFailure });

    expect(classifyDatabaseError(structural)).toBe("unique_violation");
  });
});

describe("classifyDatabaseError: wrapped errors", () => {
  it("follows a cause", () => {
    expect(classifyDatabaseError(new Error("wrapper", { cause: uniqueFailure }))).toBe(
      "unique_violation",
    );
  });

  it("lets the outermost matching error win: connection over unique violation", () => {
    expect(classifyDatabaseError({ ...connectionFailure, cause: uniqueFailure })).toBe(
      "connection",
    );
  });

  it("lets the outermost matching error win: unique violation over connection", () => {
    expect(classifyDatabaseError({ ...uniqueFailure, cause: connectionFailure })).toBe(
      "unique_violation",
    );
  });

  it("gives unknown for a cyclic chain", () => {
    const first: { cause?: unknown } = {};
    const second = { cause: first };
    first.cause = second;

    expect(classifyDatabaseError(first)).toBe("unknown");
  });

  it("gives unknown for an error that is its own cause", () => {
    const error: { cause?: unknown } = {};
    error.cause = error;

    expect(classifyDatabaseError(error)).toBe("unknown");
  });

  it("looks at the error and at most 5 causes", () => {
    expect(classifyDatabaseError(nestCause(5, uniqueFailure))).toBe("unique_violation");
    expect(classifyDatabaseError(nestCause(6, uniqueFailure))).toBe("unknown");
  });
});

describe("classifyDatabaseError: hostile input never throws", () => {
  const explode = (): never => {
    throw new Error("a getter blew up");
  };

  it.each([
    [
      "code",
      {
        get code(): unknown {
          return explode();
        },
      },
    ],
    [
      "cause",
      {
        get cause(): unknown {
          return explode();
        },
      },
    ],
    [
      "meta",
      {
        code: "P2010",
        get meta(): unknown {
          return explode();
        },
      },
    ],
    ["message", Object.defineProperty(new Error("x"), "message", { get: explode })],
    ["a proxy", new Proxy({}, { get: explode, getPrototypeOf: explode, has: explode })],
  ])("gives unknown when reading %s throws", (_description, error) => {
    expect(classifyDatabaseError(error)).toBe("unknown");
  });

  it("only ever returns a listed kind", () => {
    const inputs = [undefined, uniqueFailure, connectionFailure, new Error(poolTimeoutText), {}];

    for (const input of inputs) {
      expect(DATABASE_ERROR_KINDS).toContain(classifyDatabaseError(input));
    }
  });
});
