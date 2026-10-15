import { describe, expect, it } from "vitest";
import type { Clock } from "../../clock/clock.js";
import { AddressRateLimitedError } from "../../rate-limit/address-rate-limited-error.js";
import { ADMIN_LOGIN_ACCOUNT_WINDOW_MS } from "./admin-http-limits.js";
import { AdminLoginAccountRateLimiter } from "./admin-login-account-rate-limiter.js";

class ManualClock implements Clock {
  private current = new Date("2026-10-12T08:00:00.000Z");
  now(): Date {
    return this.current;
  }
  advance(milliseconds: number): void {
    this.current = new Date(this.current.getTime() + milliseconds);
  }
}

function build(): { limiter: AdminLoginAccountRateLimiter; clock: ManualClock } {
  const clock = new ManualClock();
  return { limiter: new AdminLoginAccountRateLimiter(clock), clock };
}

function failTimes(limiter: AdminLoginAccountRateLimiter, email: string, times: number): void {
  for (let index = 0; index < times; index += 1) {
    limiter.assertNotLimited(email);
    limiter.recordFailure(email);
  }
}

describe("AdminLoginAccountRateLimiter", () => {
  it("allows 10 failures, then refuses the account with the same error as an address", () => {
    const { limiter } = build();

    failTimes(limiter, "ana@example.mg", 10);

    expect(() => {
      limiter.assertNotLimited("ana@example.mg");
    }).toThrow(AddressRateLimitedError);
  });

  it("only counts failures: checking does not use an attempt", () => {
    const { limiter } = build();

    for (let index = 0; index < 50; index += 1) {
      limiter.assertNotLimited("ana@example.mg");
    }

    expect(() => {
      failTimes(limiter, "ana@example.mg", 10);
    }).not.toThrow();
  });

  it("does not limit another account", () => {
    const { limiter } = build();
    failTimes(limiter, "ana@example.mg", 10);

    expect(() => {
      limiter.assertNotLimited("bako@example.mg");
    }).not.toThrow();
  });

  it("forgets the failures once the 15 minutes have passed", () => {
    const { limiter, clock } = build();
    failTimes(limiter, "ana@example.mg", 10);

    clock.advance(ADMIN_LOGIN_ACCOUNT_WINDOW_MS);

    expect(() => {
      limiter.assertNotLimited("ana@example.mg");
    }).not.toThrow();
  });
});
