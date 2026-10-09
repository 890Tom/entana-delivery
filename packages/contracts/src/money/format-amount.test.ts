import { describe, expect, it } from "vitest";

import { formatAmount } from "./format-amount.js";

// Expected strings use U+00A0 (non-breaking space), written as an escape so it stays visible.
describe("formatAmount", () => {
  describe("with valid amounts", () => {
    it.each([
      [0, "0\u00a0Ar"],
      [1, "1\u00a0Ar"],
      [999, "999\u00a0Ar"],
      [1000, "1\u00a0000\u00a0Ar"],
      [1500, "1\u00a0500\u00a0Ar"],
      [1234567, "1\u00a0234\u00a0567\u00a0Ar"],
    ])("formats %i as %j", (amount, expected) => {
      expect(formatAmount(amount)).toBe(expected);
    });
  });

  describe("with invalid amounts", () => {
    it.each([
      ["a negative number", -1],
      ["a non-integer", 1.5],
      ["NaN", Number.NaN],
      ["Infinity", Number.POSITIVE_INFINITY],
    ])("rejects %s", (_label, amount) => {
      expect(() => formatAmount(amount)).toThrow(RangeError);
    });
  });
});
