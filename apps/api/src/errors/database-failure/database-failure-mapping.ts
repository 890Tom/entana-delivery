import { classifyDatabaseError } from "@entana/database";
import type { DatabaseErrorKind } from "@entana/database";

type DatabaseFailureLevel = "warn" | "info" | "error";

export interface DatabaseFailureResponse {
  readonly status: 404 | 409 | 500 | 503;
  /** A fixed sentence: it never mentions the database, SQL, a table, a constraint, a record or an id. */
  readonly detail: string;
  readonly level: DatabaseFailureLevel;
}

const UNAVAILABLE: DatabaseFailureResponse = {
  status: 503,
  detail: "The service is temporarily unavailable.",
  level: "warn",
};
const CONFLICT: DatabaseFailureResponse = {
  status: 409,
  detail: "The request conflicts with the current state of the service.",
  level: "info",
};
const NOT_FOUND: DatabaseFailureResponse = {
  status: 404,
  detail: "The requested resource was not found.",
  level: "info",
};
const INTERNAL_ERROR: DatabaseFailureResponse = {
  status: 500,
  detail: "An unexpected error occurred.",
  level: "error",
};

/**
 * One entry per kind of the closed list: `satisfies Record<DatabaseErrorKind, ...>` makes the
 * build fail when @entana/database adds a kind that is not mapped here.
 */
export const DATABASE_FAILURE_RESPONSES = {
  connection: UNAVAILABLE,
  timeout: UNAVAILABLE,
  unique_violation: CONFLICT,
  foreign_key_violation: CONFLICT,
  record_not_found: NOT_FOUND,
  check_violation: INTERNAL_ERROR,
  not_null_violation: INTERNAL_ERROR,
  // Never reached at runtime (readDatabaseFailureKind filters `unknown`: the generic 500 path owns
  // it and its log line). The entry only keeps the table exhaustive.
  unknown: INTERNAL_ERROR,
} as const satisfies Record<DatabaseErrorKind, DatabaseFailureResponse>;

export function mapDatabaseFailure(kind: DatabaseErrorKind): DatabaseFailureResponse {
  return DATABASE_FAILURE_RESPONSES[kind];
}

/** The kind of a database failure, or undefined when the error is not one the classifier knows. */
export function readDatabaseFailureKind(
  error: unknown,
): Exclude<DatabaseErrorKind, "unknown"> | undefined {
  const kind = classifyDatabaseError(error);
  return kind === "unknown" ? undefined : kind;
}
