import { DATABASE_ERROR_KINDS } from "@entana/database";
import type { DatabaseErrorKind } from "@entana/database";
import { describe, expect, expectTypeOf, it } from "vitest";
import { DATABASE_FAILURE_RESPONSES, mapDatabaseFailure } from "./database-failure-mapping.js";

const unavailable = {
  status: 503,
  detail: "The service is temporarily unavailable.",
  level: "warn",
};
const conflict = {
  status: 409,
  detail: "The request conflicts with the current state of the service.",
  level: "info",
};
const notFound = { status: 404, detail: "The requested resource was not found.", level: "info" };
const internalError = { status: 500, detail: "An unexpected error occurred.", level: "error" };

const expected: Readonly<Record<DatabaseErrorKind, unknown>> = {
  connection: unavailable,
  timeout: unavailable,
  unique_violation: conflict,
  foreign_key_violation: conflict,
  record_not_found: notFound,
  check_violation: internalError,
  not_null_violation: internalError,
  unknown: internalError,
};

describe("DATABASE_FAILURE_RESPONSES", () => {
  it("has exactly one entry for every kind of the closed list", () => {
    expect(Object.keys(DATABASE_FAILURE_RESPONSES).sort()).toEqual(
      [...DATABASE_ERROR_KINDS].sort(),
    );
  });

  it("is typed on the kinds: adding a kind to the list breaks the build until it is mapped", () => {
    expectTypeOf<keyof typeof DATABASE_FAILURE_RESPONSES>().toEqualTypeOf<DatabaseErrorKind>();
  });
});

describe("mapDatabaseFailure", () => {
  it.each(DATABASE_ERROR_KINDS)("gives the whole expected response for %s", (kind) => {
    expect(mapDatabaseFailure(kind)).toEqual(expected[kind]);
  });
});
