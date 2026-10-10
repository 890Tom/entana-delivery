import { describe, expect, it } from "vitest";
import { formatNationalNumber, maxNationalDigits } from "./format-national-number.js";

describe("formatNationalNumber for Madagascar", () => {
  it.each([
    ["3", "3"],
    ["34", "34"],
    ["341", "34 1"],
    ["3412", "34 12"],
    ["34123", "34 12 3"],
    ["341234", "34 12 34"],
    ["3412345", "34 12 345"],
    ["34123456", "34 12 345 6"],
    ["341234567", "34 12 345 67"],
  ])("groups %s as %s", (digits, expected) => {
    expect(formatNationalNumber(digits, "261")).toBe(expected);
  });

  it("stops at the longest number of the plan", () => {
    expect(formatNationalNumber("34123456789", "261")).toBe("34 12 345 67");
    expect(maxNationalDigits("261")).toBe(9);
  });
});

describe("formatNationalNumber for a country without a rule", () => {
  it("gives the digits unchanged, with no maximum", () => {
    expect(formatNationalNumber("612345678", "33")).toBe("612345678");
    expect(maxNationalDigits("33")).toBeNull();
  });

  it("does not take a key of the table's prototype for a country", () => {
    expect(maxNationalDigits("constructor")).toBeNull();
  });
});
