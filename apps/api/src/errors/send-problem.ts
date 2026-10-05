import { PROBLEM_DETAILS_CONTENT_TYPE } from "@entana/contracts";
import type { Request, Response } from "express";
import { toProblemDetails } from "./to-problem-details.js";

export interface ErrorLogger {
  error(message: string): void;
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
  const problem = toProblemDetails(error, path);

  if (problem.status >= 500) {
    // The client only gets the generic answer; the logs get what is needed to find the cause.
    logger.error(describeForLog(error));
  }
  response.status(problem.status).type(PROBLEM_DETAILS_CONTENT_TYPE).json(problem);
}
