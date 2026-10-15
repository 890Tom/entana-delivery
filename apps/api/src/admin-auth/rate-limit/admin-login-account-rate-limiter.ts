import { Inject, Injectable, Logger } from "@nestjs/common";
import { CLOCK } from "../../clock/clock.js";
import type { Clock } from "../../clock/clock.js";
import { AddressRateLimitedError } from "../../rate-limit/address-rate-limited-error.js";
import { SlidingWindowLimiter } from "../../rate-limit/sliding-window-limiter.js";
import {
  ADMIN_LOGIN_ACCOUNT_MAX_FAILURES,
  ADMIN_LOGIN_ACCOUNT_WINDOW_MS,
  ADMIN_LOGIN_MAX_TRACKED,
} from "./admin-http-limits.js";

/**
 * The limit of failed logins per account, whatever the address: it stops a guess spread over many
 * addresses. The key is the normalised e-mail, which only lives in memory (never logged), and it is
 * counted for any e-mail, existing or not, so that the count does not tell them apart. A limited
 * account refuses even the right password: that is the price of the limit, which also lets anyone
 * who knows an e-mail lock that account for the window.
 */
@Injectable()
export class AdminLoginAccountRateLimiter {
  private readonly limiter: SlidingWindowLimiter;
  private readonly logger = new Logger(AdminLoginAccountRateLimiter.name);

  constructor(@Inject(CLOCK) clock: Clock) {
    this.limiter = new SlidingWindowLimiter(
      {
        maxHits: ADMIN_LOGIN_ACCOUNT_MAX_FAILURES,
        windowMs: ADMIN_LOGIN_ACCOUNT_WINDOW_MS,
        maxKeys: ADMIN_LOGIN_MAX_TRACKED,
      },
      clock,
    );
  }

  /** Before the password is checked. @throws AddressRateLimitedError (same 429 as an address). */
  assertNotLimited(email: string): void {
    if (this.limiter.isKeyLimited(email)) {
      this.logger.warn("admin_login_account_limited");
      throw new AddressRateLimitedError();
    }
  }

  recordFailure(email: string): void {
    this.limiter.hit(email);
  }
}
