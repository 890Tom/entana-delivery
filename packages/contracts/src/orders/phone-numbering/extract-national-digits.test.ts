import { describe, expect, it } from "vitest";
import { extractNationalDigits } from "./extract-national-digits.js";

describe("extractNationalDigits for Madagascar", () => {
  it.each([
    ["digits typed one after the other", "341234567", "341234567"],
    ["a number pasted with the international prefix", "+261 34 12 345 67", "341234567"],
    ["a number pasted with the call prefix", "00261 34 12 345 67", "341234567"],
    ["a number pasted in the national form", "034 12 345 67", "341234567"],
    ["a number pasted with leading spaces", "   +261 34 12 345 67", "341234567"],
    ["the national zero after the international prefix", "+261 034 12 345 67", "341234567"],
    ["a number with dots and parentheses", "(034).12-345.67", "341234567"],
  ])("reads %s", (_label, raw, expected) => {
    expect(extractNationalDigits(raw, "261")).toBe(expected);
  });

  it("does not recognise the country code without a plus sign or a call prefix", () => {
    // Kept as digits, then cut: the prefix "26" is then refused, which is wanted.
    expect(extractNationalDigits("261 34 12 345 67", "261")).toBe("261341234");
  });

  it("drops the digits past the longest number of the plan", () => {
    expect(extractNationalDigits("34 12 345 678", "261")).toBe("341234567");
  });

  it("reads at most 64 characters of what it is given", () => {
    expect(extractNationalDigits(`${" ".repeat(70)}341234567`, "261")).toBe("");
    expect(extractNationalDigits("3".repeat(100_000), "261")).toBe("333333333");
  });

  it("removes one national zero only", () => {
    expect(extractNationalDigits("0034 12 345", "261")).toBe("03412345");
  });
});

describe("extractNationalDigits for a country without a rule", () => {
  it("keeps the first zero: it can be part of the number", () => {
    expect(extractNationalDigits("06 12 34 56 78", "39")).toBe("0612345678");
  });

  it("removes the country code, however it is written", () => {
    expect(extractNationalDigits("+39 06 12 34 56 78", "39")).toBe("0612345678");
    expect(extractNationalDigits("0039 06 12 34 56 78", "39")).toBe("0612345678");
  });

  it("stops at 15 digits in all, the country code included", () => {
    expect(extractNationalDigits("1".repeat(30), "39")).toBe("1".repeat(13));
  });
});
