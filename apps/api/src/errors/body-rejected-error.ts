import type { NextFunction } from "express";
import { readClientErrorStatus } from "./to-problem-details.js";

/** A request body the JSON parser refused (malformed, too large, wrong type). Only its status is kept. */
export class BodyRejectedError extends Error {
  constructor(readonly status: number) {
    super("The request body was rejected.");
    this.name = "BodyRejectedError";
  }
}

/**
 * Express error handler placed right after the body parser. The parser's own message can quote
 * part of the body ("Unexpected token 'x', \"...secret...\" is not valid JSON"), and Nest's
 * adapter copies the message of a SyntaxError into a BadRequestException: both must be replaced
 * before Nest sees the error, so that nothing the client sent is echoed back.
 */
export function rejectBody(
  error: unknown,
  _request: unknown,
  _response: unknown,
  next: NextFunction,
): void {
  const status = readClientErrorStatus(error);
  next(status === undefined ? error : new BodyRejectedError(status));
}
