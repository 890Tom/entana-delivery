import { describe, expect, it } from "vitest";
import { parsePhoneNumber } from "./parse-phone-number.js";

const MADAGASCAR = "261";

describe("parsePhoneNumber for Madagascar", () => {
  it.each(["32", "33", "34", "37", "38", "39"])(
    "accepts a mobile number of the operator prefix %s",
    (prefix) => {
      expect(parsePhoneNumber(`0${prefix} 12 345 67`, MADAGASCAR)).toEqual({
        ok: true,
        e164: `+261${prefix}1234567`,
        national: `${prefix}1234567`,
      });
    },
  );

  it.each([
    ["the national form", "034 12 345 67"],
    ["the international form", "+261 34 12 345 67"],
    ["the form with the international call prefix", "00261 34 12 345 67"],
    ["dots, hyphens and parentheses", "(034).12-345.67"],
  ])("gives the same canonical number for %s", (_label, input) => {
    expect(parsePhoneNumber(input, MADAGASCAR)).toEqual({
      ok: true,
      e164: "+261341234567",
      national: "341234567",
    });
  });

  it.each([
    ["an operator prefix that does not exist (31)", "031 12 345 67", "invalid_operator_prefix"],
    ["an operator prefix that does not exist (35)", "035 12 345 67", "invalid_operator_prefix"],
    ["an operator prefix that does not exist (36)", "036 12 345 67", "invalid_operator_prefix"],
    ["an operator prefix that does not exist (30)", "030 12 345 67", "invalid_operator_prefix"],
    ["a landline (20)", "020 22 123 45", "invalid_operator_prefix"],
    ["too few digits", "034 12 345 6", "too_short"],
    ["very few digits", "034 12", "too_short"],
    ["too many digits", "034 12 345 678", "too_long"],
    ["a text that is far too long", "0".repeat(33), "too_long"],
    ["a letter", "034 12 345 6a", "invalid_characters"],
    ["a plus sign that is not first", "034+12 345 67", "invalid_characters"],
    ["another country", "+33 6 12 34 56 78", "country_not_accepted"],
    ["the country code without a plus or a zero", "261 34 12 345 67", "country_not_accepted"],
    ["a zero set apart", "0 34 12 345 67", "country_not_accepted"],
  ])("refuses %s", (_label, input, reason) => {
    expect(parsePhoneNumber(input, MADAGASCAR)).toEqual({ ok: false, reason });
  });

  it("never repeats the input in what it returns", () => {
    const result = parsePhoneNumber("034 12 345 6a", MADAGASCAR);

    expect(JSON.stringify(result)).not.toMatch(/034|12 345/);
  });
});

describe("parsePhoneNumber for a country without a rule", () => {
  it("keeps the generic validation: a number of another country is accepted as before", () => {
    expect(parsePhoneNumber("06 12 34 56 78", "33")).toEqual({
      ok: true,
      e164: "+33612345678",
      national: "612345678",
    });
  });

  it("keeps the generic refusals", () => {
    expect(parsePhoneNumber("12345", "33")).toEqual({ ok: false, reason: "too_short" });
  });
});
