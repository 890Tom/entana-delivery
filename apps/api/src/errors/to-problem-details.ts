import { STATUS_CODES } from "node:http";
import { HttpException } from "@nestjs/common";
import { GENERIC_PROBLEM_TYPE, VALIDATION_PROBLEM_TYPE } from "@entana/contracts";
import type { ProblemDetails } from "@entana/contracts";
import type { DatabaseErrorKind } from "@entana/database";
import {
  mapDatabaseFailure,
  readDatabaseFailureKind,
} from "./database-failure/database-failure-mapping.js";
import { RequestValidationError } from "./request-validation-error.js";
import { ServiceNotReadyError } from "./service-not-ready-error.js";

const INTERNAL_ERROR_DETAIL = "An unexpected error occurred.";
const NOT_READY_DETAIL = "The service is not ready.";

// Messages of the HTTP layer (the body parser) can repeat parts of the request, so they are
// replaced by fixed texts.
const CLIENT_ERROR_DETAILS: Readonly<Record<number, string>> = {
  400: "The request body is not valid JSON.",
  413: "The request body is too large.",
  415: "The content type of the request is not supported.",
};

function titleOf(status: number): string {
  return STATUS_CODES[status] ?? "Error";
}

function problem(status: number, detail: string, instance: string): ProblemDetails {
  return { type: GENERIC_PROBLEM_TYPE, title: titleOf(status), status, detail, instance };
}

// The body parser raises errors that are not Nest exceptions but carry a status.
export function readClientErrorStatus(error: unknown): number | undefined {
  if (typeof error !== "object" || error === null || !("status" in error)) {
    return undefined;
  }
  const { status } = error;
  return typeof status === "number" && Number.isInteger(status) && status >= 400 && status < 500
    ? status
    : undefined;
}

export interface ResolvedFailure {
  readonly problem: ProblemDetails;
  /** Set only when the answer comes from a classified database failure (never `unknown`). */
  readonly databaseKind: Exclude<DatabaseErrorKind, "unknown"> | undefined;
}

function resolved(problem: ProblemDetails): ResolvedFailure {
  return { problem, databaseKind: undefined };
}

/**
 * The only place that decides the answer sent to the client (RFC 9457), and whether it comes from
 * a database failure: the log line and the body always agree because both read this result.
 * An error that is not a known client error never contributes its message to the answer.
 */
export function resolveFailure(error: unknown, instance: string): ResolvedFailure {
  if (error instanceof RequestValidationError) {
    return resolved({
      ...problem(400, error.message, instance),
      type: VALIDATION_PROBLEM_TYPE,
      errors: [...error.fieldErrors],
    });
  }
  if (error instanceof ServiceNotReadyError) {
    return resolved(problem(503, NOT_READY_DETAIL, instance));
  }
  if (error instanceof HttpException) {
    const status = error.getStatus();
    return resolved(
      problem(status, status < 500 ? error.message : INTERNAL_ERROR_DETAIL, instance),
    );
  }
  const clientStatus = readClientErrorStatus(error);
  if (clientStatus !== undefined) {
    return resolved(
      problem(clientStatus, CLIENT_ERROR_DETAILS[clientStatus] ?? titleOf(clientStatus), instance),
    );
  }
  const databaseKind = readDatabaseFailureKind(error);
  if (databaseKind !== undefined) {
    const { status, detail } = mapDatabaseFailure(databaseKind);
    return { problem: problem(status, detail, instance), databaseKind };
  }
  return resolved(problem(500, INTERNAL_ERROR_DETAIL, instance));
}

export function toProblemDetails(error: unknown, instance: string): ProblemDetails {
  return resolveFailure(error, instance).problem;
}
