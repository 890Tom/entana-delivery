import type { NextFunction, Request, Response } from "express";

/**
 * The three headers of every answer of the tracking routes, errors included: the answer holds an
 * order, so it is never stored, indexed or passed on in a Referer. Set before anything else, so
 * that a limit, a parse error or an unexpected failure carries them too.
 */
export function setTrackingResponseHeaders(
  _request: Request,
  response: Response,
  next: NextFunction,
): void {
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("X-Robots-Tag", "noindex");
  response.setHeader("Referrer-Policy", "no-referrer");
  next();
}

/**
 * These routes read no body. Without a content type the JSON parser skips the request, so a body
 * (malformed, huge or hostile) is neither read nor able to change the answer.
 */
export function ignoreRequestBody(request: Request, _response: Response, next: NextFunction): void {
  delete request.headers["content-type"];
  next();
}
