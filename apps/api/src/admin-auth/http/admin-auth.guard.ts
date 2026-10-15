import { Inject, Injectable } from "@nestjs/common";
import type { CanActivate, ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import { AdminSessionService } from "../admin-session.service.js";
import { ADMIN_PUBLIC_KEY } from "./admin-public.decorator.js";
import { setAuthenticatedAdmin } from "./authenticated-admin.js";
import { isAdminPath } from "./is-admin-path.js";
import { readSessionToken } from "./session-cookie.js";
import type { SessionCookieSettings } from "./session-cookie.js";

export const ADMIN_COOKIE_SETTINGS = Symbol("ADMIN_COOKIE_SETTINGS");

/**
 * Closes everything under /api/v1/admin by default: the decision is made on the path of the
 * request, not on a decorator that a new controller could forget. A route is open only if it is
 * marked `@adminPublic()`. Every other route of the application passes through untouched.
 */
@Injectable()
export class AdminAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly sessions: AdminSessionService,
    @Inject(ADMIN_COOKIE_SETTINGS) private readonly cookie: SessionCookieSettings,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    if (!isAdminPath(request.path)) {
      return true;
    }
    const isPublic = this.reflector.getAllAndOverride<boolean | undefined>(ADMIN_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic === true) {
      return true;
    }
    const token = readSessionToken(request.headers.cookie, this.cookie);
    setAuthenticatedAdmin(request, await this.sessions.authenticate(token));
    return true;
  }
}
