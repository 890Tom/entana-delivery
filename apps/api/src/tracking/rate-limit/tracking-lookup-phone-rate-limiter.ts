import { Inject, Injectable, Logger } from "@nestjs/common";
import { CLOCK } from "../../clock/clock.js";
import type { Clock } from "../../clock/clock.js";
import { AddressRateLimitedError } from "../../orders/errors/order-errors.js";
import { SlidingWindowLimiter } from "../../orders/rate-limit/sliding-window-limiter.js";
import {
  TRACKING_LOOKUP_PHONE_MAX_ATTEMPTS,
  TRACKING_LOOKUP_PHONE_WINDOW_MS,
  TRACKING_MAX_TRACKED,
} from "./tracking-http-limits.js";

/**
 * The limit of order lookups per phone number (canonical E.164), whatever the client address. The
 * order code is not a secret: without it, many addresses could guess the codes of one customer
 * while each stays under the limit of an address. In memory and per instance, like the others.
 *
 * The number only lives in the memory of the limiter, as a key: it is never logged, and the
 * refusal is the same error (so the same 429 and Retry-After) as the limit of an address.
 */
@Injectable()
export class TrackingLookupPhoneRateLimiter {
  private readonly limiter: SlidingWindowLimiter;
  private readonly logger = new Logger(TrackingLookupPhoneRateLimiter.name);

  constructor(@Inject(CLOCK) clock: Clock) {
    this.limiter = new SlidingWindowLimiter(
      {
        maxHits: TRACKING_LOOKUP_PHONE_MAX_ATTEMPTS,
        windowMs: TRACKING_LOOKUP_PHONE_WINDOW_MS,
        maxKeys: TRACKING_MAX_TRACKED,
      },
      clock,
    );
  }

  /** Counts one attempt for this number. @throws AddressRateLimitedError beyond the limit. */
  consume(phoneE164: string): void {
    if (!this.limiter.hit(phoneE164)) {
      this.logger.warn("tracking_lookup_phone_limited");
      throw new AddressRateLimitedError();
    }
  }
}
