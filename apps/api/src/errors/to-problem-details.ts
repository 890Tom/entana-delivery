import { STATUS_CODES } from "node:http";
import { HttpException } from "@nestjs/common";
import { GENERIC_PROBLEM_TYPE, VALIDATION_PROBLEM_TYPE } from "@entana/contracts";
import type { ProblemDetails } from "@entana/contracts";
import { RequestValidationError } from "./request-validation-error.js";

const INTERNAL_ERROR_DETAIL = "An unexpected error occurred.";

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

/**
 * The only place that turns an error into the answer sent to the client (RFC 9457).
 * An error that is not a known client error never contributes its message to the answer.
 */
export function toProblemDetails(error: unknown, instance: string): ProblemDetails {
  if (error instanceof RequestValidationError) {
    return {
      ...problem(400, error.message, instance),
      type: VALIDATION_PROBLEM_TYPE,
      errors: [...error.fieldErrors],
    };
  }
  if (error instanceof HttpException) {
    const status = error.getStatus();
    return problem(status, status < 500 ? error.message : INTERNAL_ERROR_DETAIL, instance);
  }
  const clientStatus = readClientErrorStatus(error);
  if (clientStatus !== undefined) {
    return problem(
      clientStatus,
      CLIENT_ERROR_DETAILS[clientStatus] ?? titleOf(clientStatus),
      instance,
    );
  }
  return problem(500, INTERNAL_ERROR_DETAIL, instance);
}
