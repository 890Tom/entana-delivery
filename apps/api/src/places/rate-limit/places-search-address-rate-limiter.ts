import { Inject, Injectable, Logger } from "@nestjs/common";
import type { NextFunction, Request, Response } from "express";
import { CLOCK } from "../../clock/clock.js";
import type { Clock } from "../../clock/clock.js";
import { resolveRequestId } from "../../logging/pino-http-options.js";
import { AddressRateLimitedError } from "../../rate-limit/address-rate-limited-error.js";
import { normalizeAddress } from "../../rate-limit/normalize-address.js";
import { SlidingWindowLimiter } from "../../rate-limit/sliding-window-limiter.js";
import {
  PLACES_SEARCH_MAX_REQUESTS,
  PLACES_SEARCH_MAX_TRACKED,
  PLACES_SEARCH_WINDOW_MS,
} from "./places-http-limits.js";

/**
 * The limit of place searches per client address, with its own counters: every search costs a
 * call to the provider. Same rules as `TrackingAddressRateLimiter`: an Express middleware
 * installed before the body parser, so a limited address is answered before the provider is
 * reached. Neither the address nor the searched text is logged.
 */
@Injectable()
export class PlacesSearchAddressRateLimiter {
  private readonly limiter: SlidingWindowLimiter;
  private readonly logger = new Logger(PlacesSearchAddressRateLimiter.name);

  constructor(@Inject(CLOCK) clock: Clock) {
    this.limiter = new SlidingWindowLimiter(
      {
        maxHits: PLACES_SEARCH_MAX_REQUESTS,
        windowMs: PLACES_SEARCH_WINDOW_MS,
        maxKeys: PLACES_SEARCH_MAX_TRACKED,
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
    this.logger.warn("places_search_address_limited");
    response.setHeader("X-Request-Id", resolveRequestId(request.headers["x-request-id"]));
    next(new AddressRateLimitedError());
  };
}
