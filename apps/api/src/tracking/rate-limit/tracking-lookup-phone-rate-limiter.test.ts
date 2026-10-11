import { Logger } from "@nestjs/common";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Clock } from "../../clock/clock.js";
import { AddressRateLimitedError } from "../../orders/errors/order-errors.js";
import { TrackingLookupPhoneRateLimiter } from "./tracking-lookup-phone-rate-limiter.js";

const FIXED_CLOCK: Clock = { now: () => new Date("2026-10-08T08:00:00.000Z") };
const PHONE = "+261340000000";
const OTHER_PHONE = "+261340000001";

function consume(limiter: TrackingLookupPhoneRateLimiter, phone: string, times: number): void {
  for (let attempt = 0; attempt < times; attempt += 1) {
    limiter.consume(phone);
  }
}

describe("TrackingLookupPhoneRateLimiter", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("allows 10 attempts per phone number and refuses the 11th", () => {
    const limiter = new TrackingLookupPhoneRateLimiter(FIXED_CLOCK);

    consume(limiter, PHONE, 10);

    expect(() => {
      limiter.consume(PHONE);
    }).toThrow(AddressRateLimitedError);
  });

  it("does not affect another phone number", () => {
    const limiter = new TrackingLookupPhoneRateLimiter(FIXED_CLOCK);
    consume(limiter, PHONE, 10);

    expect(() => {
      limiter.consume(OTHER_PHONE);
    }).not.toThrow();
  });

  it("writes one fixed line that holds no phone number", () => {
    const warn = vi.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);
    const limiter = new TrackingLookupPhoneRateLimiter(FIXED_CLOCK);
    consume(limiter, PHONE, 10);

    expect(() => {
      limiter.consume(PHONE);
    }).toThrow();

    expect(warn).toHaveBeenCalledExactlyOnceWith("tracking_lookup_phone_limited");
  });
});
