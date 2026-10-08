import { describe, expect, it } from "vitest";
import {
  MAX_AMOUNT_AR,
  doesAmountFitColumn,
  getRateLimitWindowStart,
  isRateLimited,
} from "./order-limits.js";

describe("order limits", () => {
  it("starts the window 60 minutes before now", () => {
    expect(getRateLimitWindowStart(new Date("2026-10-08T08:00:00.000Z")).toISOString()).toBe(
      "2026-10-08T07:00:00.000Z",
    );
  });

  it.each([
    [4, false],
    [5, true],
    [6, true],
  ])("with %i recent orders, isLimited is %s", (count, isLimited) => {
    expect(isRateLimited(count)).toBe(isLimited);
  });

  it("accepts an amount up to the integer column bound and refuses the next one", () => {
    expect(doesAmountFitColumn(MAX_AMOUNT_AR)).toBe(true);
    expect(doesAmountFitColumn(MAX_AMOUNT_AR + 1)).toBe(false);
  });
});
