import { describe, expect, it } from "vitest";
import { normalizePhone } from "./normalize-phone.js";

const MADAGASCAR = "261";
const DATABASE_PHONE_CHECK = /^\+[1-9][0-9]{6,14}$/;

const acceptedCases: readonly (readonly [string, string])[] = [
  ["+261 34 12 345 67", "+261341234567"],
  ["+261341234567", "+261341234567"],
  ["034 12 345 67", "+261341234567"],
  ["0341234567", "+261341234567"],
  ["00261341234567", "+261341234567"],
  ["(034) 12-345.67", "+261341234567"],
  ["+33 6 12 34 56 78", "+33612345678"],
  ["0033 6 12 34 56 78", "+33612345678"],
  ["+1 (415) 555-2671", "+14155552671"],
  ["+1234567", "+1234567"],
  ["+123456789012345", "+123456789012345"],
];

describe("normalizePhone", () => {
  it.each(acceptedCases)("accepts %s", (input, expected) => {
    expect(normalizePhone(input, MADAGASCAR)).toBe(expected);
  });

  it("only ever returns a value that satisfies the database CHECK on phone_e164", () => {
    for (const [input] of acceptedCases) {
      expect(normalizePhone(input, MADAGASCAR)).toMatch(DATABASE_PHONE_CHECK);
    }
  });

  it.each([
    ["an empty string", ""],
    ["only separators", " ( ) - . "],
    ["a lone plus sign", "+"],
    ["letters", "034 12 345 6a"],
    ["a word", "call me"],
    ["a plus sign that is not first", "261+341234567"],
    ["a plus sign after a space", " +261341234567"],
    ["a doubled plus sign", "++261341234567"],
    ["a second plus sign", "+261 34 +12 345 67"],
    ["Arabic-Indic digits", "+٢٦١٣٤١٢٣٤٥٦٧"],
    ["fullwidth digits", "+２６１３４１２３４５６７"],
    ["a zero-width space inside the number", "+261 34\u200B12 345 67"],
    ["a non-breaking space inside the number", "+261\u00A034 12 345 67"],
    ["a tab inside the number", "+261\t341234567"],
    ["6 digits", "+1 23 45 6"],
    ["6 digits with the country code", "+33 123 4"],
    ["16 digits", "+1234567890123456"],
    ["a country code starting with 0", "+0341234567"],
    ["a national number without trunk zero or plus sign", "34 12 345 67"],
    ["an extra zero after the default country code", "+261 034 12 345 67"],
    ["an extra zero glued to the default country code", "+2610341234567"],
    ["an extra zero after the default country code in 00 form", "00261034 12 345 67"],
    ["a trunk zero separated from the number", "0 34 12 345 67"],
    ["a trunk zero followed by a parenthesis", "0(34) 12 345 67"],
  ])("rejects %s", (_label, input) => {
    expect(normalizePhone(input, MADAGASCAR)).toBeNull();
  });

  it("rejects an otherwise valid number of 33 characters", () => {
    const input = `+261341234567${" ".repeat(20)}`;
    expect(input).toHaveLength(33);
    expect(normalizePhone(input, MADAGASCAR)).toBeNull();
  });

  it("accepts spaces around a national number", () => {
    expect(normalizePhone("  034 12 345 67 ", MADAGASCAR)).toBe("+261341234567");
  });

  it("rejects a newline after a valid number", () => {
    expect(normalizePhone("034 12 345 67\n", MADAGASCAR)).toBeNull();
  });

  it("accepts a valid number of exactly 32 characters", () => {
    const input = `+261${" ".repeat(17)}341234567${" ".repeat(2)}`;
    expect(input).toHaveLength(32);
    expect(normalizePhone(input, MADAGASCAR)).toBe("+261341234567");
  });

  it("rejects a 1 MB input", () => {
    expect(normalizePhone("1".repeat(1_000_000), MADAGASCAR)).toBeNull();
  });

  it.each(["", "0", "0261", "26a", "+261", "2611", " 261"])(
    "returns null instead of throwing for the invalid default country code %j",
    (code) => {
      expect(normalizePhone("034 12 345 67", code)).toBeNull();
    },
  );

  it("uses the default country code it is given", () => {
    expect(normalizePhone("06 12 34 56 78", "33")).toBe("+33612345678");
  });
});
