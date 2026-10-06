import type { ProblemDetails } from "@entana/contracts";
import type { DatabaseErrorKind } from "@entana/database";

// Literals on purpose: the expected answers are written out, never derived from the code under test.
// Shared by the unit tests (toProblemDetails, the filter) so that both compare whole bodies.
export function fixedDatabaseProblem(kind: DatabaseErrorKind, instance: string): ProblemDetails {
  const unavailable = {
    type: "about:blank",
    title: "Service Unavailable",
    status: 503,
    detail: "The service is temporarily unavailable.",
    instance,
  };
  const conflict = {
    type: "about:blank",
    title: "Conflict",
    status: 409,
    detail: "The request conflicts with the current state of the service.",
    instance,
  };
  const notFound = {
    type: "about:blank",
    title: "Not Found",
    status: 404,
    detail: "The requested resource was not found.",
    instance,
  };
  const internalError = {
    type: "about:blank",
    title: "Internal Server Error",
    status: 500,
    detail: "An unexpected error occurred.",
    instance,
  };
  const bodies: Record<DatabaseErrorKind, ProblemDetails> = {
    connection: unavailable,
    timeout: unavailable,
    unique_violation: conflict,
    foreign_key_violation: conflict,
    record_not_found: notFound,
    check_violation: internalError,
    not_null_violation: internalError,
    unknown: internalError,
  };
  return bodies[kind];
}
