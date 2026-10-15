import { Inject, Injectable, Logger } from "@nestjs/common";
import type { NextFunction, Request, Response } from "express";
import { CLOCK } from "../../clock/clock.js";
import type { Clock } from "../../clock/clock.js";
import { resolveRequestId } from "../../logging/pino-http-options.js";
import { normalizeAddress } from "../../rate-limit/normalize-address.js";
import { AddressRateLimitedError } from "../../rate-limit/address-rate-limited-error.js";
import {
  ADDRESS_MAX_REQUESTS,
  ADDRESS_MAX_TRACKED,
  ADDRESS_WINDOW_MS,
} from "./order-http-limits.js";
import { SlidingWindowLimiter } from "../../rate-limit/sliding-window-limiter.js";

/**
 * The limit of order creations per client address. It is an Express middleware installed before
 * the body parser (see configureApplication): a limited address is answered before its body is
 * read, validated or sent to the database. The address is `request.ip`, so behind a reverse proxy
 * it is only right when TRUST_PROXY is set (see the README). The address is never logged.
 */
@Injectable()
export class AddressRateLimiter {
  private readonly limiter: SlidingWindowLimiter;
  private readonly logger = new Logger(AddressRateLimiter.name);

  constructor(@Inject(CLOCK) clock: Clock) {
    this.limiter = new SlidingWindowLimiter(
      {
        maxHits: ADDRESS_MAX_REQUESTS,
        windowMs: ADDRESS_WINDOW_MS,
        maxKeys: ADDRESS_MAX_TRACKED,
      },
      clock,
    );
  }

  /** How many addresses are tracked now (bounded by ADDRESS_MAX_TRACKED). */
  get trackedAddresses(): number {
    return this.limiter.size;
  }

  /** Mounted on the orders path: only the creation (POST on the collection itself) is counted. */
  readonly middleware = (request: Request, response: Response, next: NextFunction): void => {
    if (request.method !== "POST" || request.path !== "/") {
      next();
      return;
    }
    if (this.limiter.hit(normalizeAddress(request.ip))) {
      next();
      return;
    }
    // The request stops before the access logger of the application, which sits after the body
    // parser: this fixed line is its access line. It holds no address, header, query or body.
    this.logger.warn("order_creation_address_limited");
    // The request id is set by the access logger, which this request never reaches. Without it
    // this answer would have fewer headers than the per-phone 429 and could be told apart.
    response.setHeader("X-Request-Id", resolveRequestId(request.headers["x-request-id"]));
    next(new AddressRateLimitedError());
  };
}
