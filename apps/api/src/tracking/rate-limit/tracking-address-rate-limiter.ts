import { Inject, Injectable, Logger } from "@nestjs/common";
import type { NextFunction, Request, Response } from "express";
import { CLOCK } from "../../clock/clock.js";
import type { Clock } from "../../clock/clock.js";
import { resolveRequestId } from "../../logging/pino-http-options.js";
import { AddressRateLimitedError } from "../../orders/errors/order-errors.js";
import { normalizeAddress } from "../../rate-limit/normalize-address.js";
import { SlidingWindowLimiter } from "../../rate-limit/sliding-window-limiter.js";
import {
  TRACKING_MAX_REQUESTS,
  TRACKING_MAX_TRACKED,
  TRACKING_WINDOW_MS,
} from "./tracking-http-limits.js";

/**
 * The limit of tracking requests per client address, separate from the one of the order creation:
 * it has its own counters, so that a customer who follows an order never uses up the budget of
 * creating one. An Express middleware installed before the body parser: a limited address is
 * answered before its body is read or the database is reached. The address is never logged.
 */
@Injectable()
export class TrackingAddressRateLimiter {
  private readonly limiter: SlidingWindowLimiter;
  private readonly logger = new Logger(TrackingAddressRateLimiter.name);

  constructor(@Inject(CLOCK) clock: Clock) {
    this.limiter = new SlidingWindowLimiter(
      {
        maxHits: TRACKING_MAX_REQUESTS,
        windowMs: TRACKING_WINDOW_MS,
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
    // The request stops before the access logger of the application: this fixed line is its
    // access line. It holds no address, header, query or body.
    this.logger.warn("tracking_address_limited");
    response.setHeader("X-Request-Id", resolveRequestId(request.headers["x-request-id"]));
    next(new AddressRateLimitedError());
  };
}
