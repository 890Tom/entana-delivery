import { PROBLEM_DETAILS_CONTENT_TYPE } from "@entana/contracts";
import type { Request, Response } from "express";
import type { DatabaseErrorKind } from "@entana/database";
import { mapDatabaseFailure } from "./database-failure/database-failure-mapping.js";
import { ServiceNotReadyError } from "./service-not-ready-error.js";
import { resolveFailure } from "./to-problem-details.js";

/** The only field a database failure line carries: a member of the closed list of kinds. */
interface FailureLogContext {
  readonly reason: DatabaseErrorKind;
}

export interface ErrorLogger {
  error(message: string): void;
  error(context: FailureLogContext, message: string): void;
  warn(context: FailureLogContext, message: string): void;
  log(context: FailureLogContext, message: string): void;
}

const DATABASE_FAILURE_MESSAGE = "Database operation failed.";

// Fixed text and the kind only: the error itself can hold the host, SQL, a table or a value.
function logDatabaseFailure(logger: ErrorLogger, kind: DatabaseErrorKind): void {
  const context: FailureLogContext = { reason: kind };
  switch (mapDatabaseFailure(kind).level) {
    case "warn":
      logger.warn(context, DATABASE_FAILURE_MESSAGE);
      return;
    case "info":
      // The Nest logger has no `info`: its `log` is the info level.
      logger.log(context, DATABASE_FAILURE_MESSAGE);
      return;
    case "error":
      logger.error(context, DATABASE_FAILURE_MESSAGE);
      return;
  }
}

// The message of an error can hold personal data (a phone number in a failed query, an address
// in a validation failure), so only the type and the stack frames are logged.
function describeForLog(error: unknown): string {
  if (!(error instanceof Error)) {
    return "A value that is not an Error was thrown.";
  }
  const frames = (error.stack?.split("\n") ?? []).filter((line) => /^\s+at /.test(line));
  return [error.name, ...frames].join("\n");
}

/** Writes the application/problem+json answer for an error, and logs the ones that are our fault. */
export function sendProblem(
  request: Request,
  response: Response,
  error: unknown,
  logger: ErrorLogger,
): void {
  // originalUrl, not path: Express makes `path` relative to the router that handles the request.
  // The query string is left out of the instance: it can hold personal data.
  const [path = ""] = request.originalUrl.split("?");
  const { problem, databaseKind } = resolveFailure(error, path);

  // Exactly one branch writes: a classified database failure logs its kind only, the readiness
  // check logged its own failure already (a second line would only repeat it), and any other
  // server error keeps the single line with the type and the stack frames.
  if (databaseKind !== undefined) {
    logDatabaseFailure(logger, databaseKind);
  } else if (problem.status >= 500 && !(error instanceof ServiceNotReadyError)) {
    // The client only gets the generic answer; the logs get what is needed to find the cause.
    logger.error(describeForLog(error));
  }
  response.status(problem.status).type(PROBLEM_DETAILS_CONTENT_TYPE).json(problem);
}
