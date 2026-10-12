import { describe, expect, it } from "vitest";
import { ORDER_STATUSES } from "../tracking/tracking-response.js";
import { canTransition } from "./order-transitions.js";

const ALLOWED = new Set([
  "NEW>CONFIRMED",
  "NEW>REJECTED",
  "CONFIRMED>OUT_FOR_DELIVERY",
  "CONFIRMED>REJECTED",
  "CONFIRMED>CANCELLED",
  "OUT_FOR_DELIVERY>DELIVERED",
  "OUT_FOR_DELIVERY>FAILED",
]);

describe("canTransition", () => {
  const pairs = ORDER_STATUSES.flatMap((from) => ORDER_STATUSES.map((to) => [from, to] as const));

  it.each(pairs)("answers for %s to %s as the table of the shop says", (from, to) => {
    expect(canTransition(from, to)).toBe(ALLOWED.has(`${from}>${to}`));
  });
});
