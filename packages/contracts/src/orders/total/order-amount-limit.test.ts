import { describe, expect, it } from "vitest";
import { MAX_AMOUNT_AR, doesAmountFitColumn } from "./order-amount-limit.js";

describe("doesAmountFitColumn", () => {
  it("accepts an amount up to the integer column bound and refuses the next one", () => {
    expect(doesAmountFitColumn(MAX_AMOUNT_AR)).toBe(true);
    expect(doesAmountFitColumn(MAX_AMOUNT_AR + 1)).toBe(false);
  });
});
