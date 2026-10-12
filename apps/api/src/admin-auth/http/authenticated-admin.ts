import { createParamDecorator } from "@nestjs/common";
import type { ExecutionContext } from "@nestjs/common";
import type { AdminProfile } from "@entana/contracts";
import type { Request } from "express";
import { AdminUnauthenticatedError } from "../errors/admin-auth-errors.js";

// Kept beside the request, not on it: the request type stays Express's own.
const authenticated = new WeakMap<Request, AdminProfile>();

/** Called by the guard once the session is proven. */
export function setAuthenticatedAdmin(request: Request, admin: AdminProfile): void {
  authenticated.set(request, admin);
}

/**
 * The admin that the guard authenticated, for the handler. A route that is public (no guard
 * check) has none, and asking for one is refused rather than answered with a blank identity.
 */
export const currentAdmin = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AdminProfile => {
    const admin = authenticated.get(context.switchToHttp().getRequest<Request>());
    if (admin === undefined) {
      throw new AdminUnauthenticatedError();
    }
    return admin;
  },
);
