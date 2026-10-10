import { describe, expect, it } from "vitest";

import { composePhoneNumber, isValidPhone } from "./phone-number";

describe("the phone number of the contact form", () => {
  it("gives the same number with or without the national leading zero", () => {
    expect(composePhoneNumber("034 12 345 67", "261")).toBe("+261341234567");
    expect(composePhoneNumber("34 12 345 67", "261")).toBe("+261341234567");
  });

  it("is built with the country code it is given, not a fixed one", () => {
    expect(composePhoneNumber("06 12 34 56 78", "33")).toBe("+33612345678");
  });

  it.each([
    ["with a leading zero", "034 12 345 67"],
    ["without it", "34 12 345 67"],
    ["with dots", "034.12.345.67"],
    ["with parentheses and hyphens", "(034) 12-345-67"],
    ["with the zero apart", "0 34 12 345 67"],
  ])("accepts a number %s", (_label, typed) => {
    expect(isValidPhone(typed, "261")).toBe(true);
  });

  it.each([
    ["empty", ""],
    ["too short", "12"],
    ["too long", "034 12 345 67 890 123 456"],
    ["with a letter", "034 12 345 6a"],
    ["with a plus sign", "+261 34 12 345 67"],
    ["with the international prefix", "00 261 34 12 345 67"],
  ])("refuses a number that is %s", (_label, typed) => {
    expect(isValidPhone(typed, "261")).toBe(false);
  });
});
