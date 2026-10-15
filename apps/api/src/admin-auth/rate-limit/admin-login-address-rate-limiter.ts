import { Inject, Injectable, Logger } from "@nestjs/common";
import type { NextFunction, Request, Response } from "express";
import { CLOCK } from "../../clock/clock.js";
import type { Clock } from "../../clock/clock.js";
import { resolveRequestId } from "../../logging/pino-http-options.js";
import { AddressRateLimitedError } from "../../orders/errors/order-errors.js";
import { normalizeAddress } from "../../rate-limit/normalize-address.js";
import { SlidingWindowLimiter } from "../../rate-limit/sliding-window-limiter.js";
import { TRACKING_MAX_TRACKED } from "../../tracking/rate-limit/tracking-http-limits.js";
import {
  ADMIN_LOGIN_ADDRESS_MAX_ATTEMPTS,
  ADMIN_LOGIN_ADDRESS_WINDOW_MS,
} from "./admin-http-limits.js";

/**
 * The limit of login attempts per client address. An Express middleware installed before the body
 * parser, like the limits of the tracking routes: a limited address is answered before its body is
 * read or the database is reached. Every attempt counts, whatever its outcome. The address is
 * never logged.
 */
@Injectable()
export class AdminLoginAddressRateLimiter {
  private readonly limiter: SlidingWindowLimiter;
  private readonly logger = new Logger(AdminLoginAddressRateLimiter.name);

  constructor(@Inject(CLOCK) clock: Clock) {
    this.limiter = new SlidingWindowLimiter(
      {
        maxHits: ADMIN_LOGIN_ADDRESS_MAX_ATTEMPTS,
        windowMs: ADMIN_LOGIN_ADDRESS_WINDOW_MS,
        maxKeys: TRACKING_MAX_TRACKED,
      },
      clock,
    );
  }

  readonly middleware = (request: Request, response: Response, next: NextFunction): void => {
    if (this.limiter.hit(normalizeAddress(request.ip))) {
      next();
      return;
    }
    // This fixed line is the access line of the request: no address, header or body.
    this.logger.warn("admin_login_address_limited");
    response.setHeader("X-Request-Id", resolveRequestId(request.headers["x-request-id"]));
    next(new AddressRateLimitedError());
  };
}
