import { describe, expect, it } from "vitest";
import {
  TRACKING_RETENTION_DAYS,
  isCancellableStatus,
  isFinalStatus,
  isTrackingExpired,
} from "./tracking-rules.js";
import { ORDER_STATUSES } from "./tracking-response.js";
import type { OrderStatus } from "./tracking-response.js";

const NOW = new Date("2026-10-08T08:00:00.000Z");
const DAY_MS = 86_400_000;
const daysAgo = (days: number, extraMs = 0): Date =>
  new Date(NOW.getTime() - days * DAY_MS - extraMs);

describe("isCancellableStatus", () => {
  it.each<[OrderStatus, boolean]>([
    ["NEW", true],
    ["CONFIRMED", true],
    ["OUT_FOR_DELIVERY", false],
    ["DELIVERED", false],
    ["REJECTED", false],
    ["CANCELLED", false],
    ["FAILED", false],
  ])("%s -> %s", (status, isCancellable) => {
    expect(isCancellableStatus(status)).toBe(isCancellable);
  });
});

describe("isFinalStatus", () => {
  it("is final for the four statuses that end an order, and only those", () => {
    const finals = ORDER_STATUSES.filter((status) => isFinalStatus(status));
    expect(finals).toEqual(["DELIVERED", "REJECTED", "CANCELLED", "FAILED"]);
  });
});

describe("isTrackingExpired", () => {
  it("keeps the retention at 30 days", () => {
    expect(TRACKING_RETENTION_DAYS).toBe(30);
  });

  it("does not expire a final order at exactly the retention limit", () => {
    expect(isTrackingExpired("DELIVERED", daysAgo(TRACKING_RETENTION_DAYS), NOW)).toBe(false);
  });

  it("expires a final order one millisecond past the retention limit", () => {
    expect(isTrackingExpired("DELIVERED", daysAgo(TRACKING_RETENTION_DAYS, 1), NOW)).toBe(true);
  });

  it("never expires an order that is not final, however old", () => {
    expect(isTrackingExpired("OUT_FOR_DELIVERY", daysAgo(400), NOW)).toBe(false);
  });
});
