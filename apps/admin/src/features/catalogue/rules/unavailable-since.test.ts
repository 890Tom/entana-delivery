import { describe, expect, it } from "vitest";

import { daysUnavailable } from "./unavailable-since";

// 10:00 in Antananarivo (UTC+3) on 12 October.
const now = new Date("2026-10-12T07:00:00.000Z");

describe("the days a product has been unavailable", () => {
  it("is 0 for a change made today in the shop's time zone", () => {
    expect(daysUnavailable("2026-10-12T00:30:00.000Z", now)).toBe(0);
  });

  it("counts calendar days in the shop's time zone, not 24 hour spans", () => {
    // 23:30 UTC on the 11th is already the 12th at the shop.
    expect(daysUnavailable("2026-10-11T23:30:00.000Z", now)).toBe(0);
    // 20:30 UTC on the 10th is 23:30 on the 10th at the shop: two days ago.
    expect(daysUnavailable("2026-10-10T20:30:00.000Z", now)).toBe(2);
    expect(daysUnavailable("2026-10-11T08:00:00.000Z", now)).toBe(1);
  });

  it("never goes below zero when the change is dated after the clock", () => {
    expect(daysUnavailable("2026-10-14T08:00:00.000Z", now)).toBe(0);
  });
});
