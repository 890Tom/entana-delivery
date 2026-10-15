import { describe, expect, it } from "vitest";
import {
  RESELLER_VERIFICATION_MAX_AGE_DAYS,
  isResellerVerificationStale,
} from "./reseller-verification.js";

const NOW = new Date("2026-10-13T08:00:00.000Z");
const DAY_MS = 24 * 60 * 60 * 1000;
const daysBefore = (days: number): Date => new Date(NOW.getTime() - days * DAY_MS);

describe("isResellerVerificationStale", () => {
  it("is stale when the reseller was never verified", () => {
    expect(isResellerVerificationStale(null, NOW)).toBe(true);
  });

  it("is stale when the verification is older than the maximum age", () => {
    expect(isResellerVerificationStale(daysBefore(91), NOW)).toBe(true);
  });

  it("is not stale when the verification is recent", () => {
    expect(isResellerVerificationStale(daysBefore(10), NOW)).toBe(false);
  });

  it("is not stale on the last day of the maximum age", () => {
    expect(RESELLER_VERIFICATION_MAX_AGE_DAYS).toBe(90);
    expect(isResellerVerificationStale(daysBefore(90), NOW)).toBe(false);
  });
});
