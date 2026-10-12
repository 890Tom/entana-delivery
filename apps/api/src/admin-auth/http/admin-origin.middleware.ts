import type { NextFunction, Request, Response } from "express";
import { AdminOriginRefusedError } from "../errors/admin-auth-errors.js";
import { hasSessionCookie } from "./session-cookie.js";
import type { SessionCookieSettings } from "./session-cookie.js";

const READ_ONLY_METHODS: ReadonlySet<string> = new Set(["GET", "HEAD", "OPTIONS"]);

export interface AdminOriginOptions {
  readonly allowedOrigins: readonly string[];
  readonly cookie: SessionCookieSettings;
}

/**
 * Cross-site request forgery guard for the requests of the administration that change something.
 * SameSite=Strict is the first defence; this is the second. An Origin that is present must be one
 * of the configured origins. A request with no Origin is refused only when it carries the session
 * cookie: that is a browser that hides its origin, not a command-line client with no cookie.
 */
export function createAdminOriginMiddleware(
  options: AdminOriginOptions,
): (request: Request, response: Response, next: NextFunction) => void {
  const allowed = new Set(options.allowedOrigins);
  return (request, _response, next) => {
    if (READ_ONLY_METHODS.has(request.method)) {
      next();
      return;
    }
    const origin = request.headers.origin;
    const isAllowed =
      origin === undefined
        ? !hasSessionCookie(request.headers.cookie, options.cookie)
        : allowed.has(origin);
    next(isAllowed ? undefined : new AdminOriginRefusedError());
  };
}
