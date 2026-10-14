import { describe, expect, it } from "vitest";
import { toFeeReason } from "./to-fee-reason.js";

describe("toFeeReason", () => {
  it.each([
    ["axis", "IN_AXIS"],
    ["out_of_axis", "OUT_OF_AXIS"],
    ["quantity", "QUANTITY"],
  ] as const)("stores the reason %s as %s", (reason, stored) => {
    expect(toFeeReason(reason)).toBe(stored);
  });
});
