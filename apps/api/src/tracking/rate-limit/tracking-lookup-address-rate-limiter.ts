import { Inject, Injectable, Logger } from "@nestjs/common";
import type { NextFunction, Request, Response } from "express";
import { CLOCK } from "../../clock/clock.js";
import type { Clock } from "../../clock/clock.js";
import { resolveRequestId } from "../../logging/pino-http-options.js";
import { AddressRateLimitedError } from "../../orders/errors/order-errors.js";
import { normalizeAddress } from "../../rate-limit/normalize-address.js";
import { SlidingWindowLimiter } from "../../rate-limit/sliding-window-limiter.js";
import {
  TRACKING_LOOKUP_MAX_REQUESTS,
  TRACKING_LOOKUP_WINDOW_MS,
  TRACKING_MAX_TRACKED,
} from "./tracking-http-limits.js";

/**
 * The limit of order lookups (phone number and code) per client address: its own counters, tighter
 * than the tracking routes. Same rules as `TrackingAddressRateLimiter`: an Express middleware
 * installed before the body parser, so a limited address is answered before its body is read or
 * the database is reached. The address is never logged.
 */
@Injectable()
export class TrackingLookupAddressRateLimiter {
  private readonly limiter: SlidingWindowLimiter;
  private readonly logger = new Logger(TrackingLookupAddressRateLimiter.name);

  constructor(@Inject(CLOCK) clock: Clock) {
    this.limiter = new SlidingWindowLimiter(
      {
        maxHits: TRACKING_LOOKUP_MAX_REQUESTS,
        windowMs: TRACKING_LOOKUP_WINDOW_MS,
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
    this.logger.warn("tracking_lookup_address_limited");
    response.setHeader("X-Request-Id", resolveRequestId(request.headers["x-request-id"]));
    next(new AddressRateLimitedError());
  };
}
