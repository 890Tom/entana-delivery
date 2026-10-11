import { describe, expect, it } from "vitest";
import { normalizeOrderCode } from "./normalize-order-code.js";
import { orderCodeSchema } from "./order-code.js";

describe("normalizeOrderCode", () => {
  it("uppercases a code typed in lowercase", () => {
    expect(normalizeOrderCode("abc234")).toBe("ABC234");
  });

  it.each([
    ["ab c2 34", "ABC234"],
    ["abc-234", "ABC234"],
    [" a-b c-2 3-4 ", "ABC234"],
    ["ABC\t234", "ABC234"],
  ])("removes the spaces and hyphens of %j", (input, expected) => {
    expect(normalizeOrderCode(input)).toBe(expected);
  });

  it("leaves the other characters to the code schema, which refuses them", () => {
    const normalized = normalizeOrderCode("abc-0o1");

    expect(normalized).toBe("ABC0O1");
    expect(orderCodeSchema.safeParse(normalized).success).toBe(false);
  });

  it("only uppercases the letters a-z: no other alphabet folds into a valid code", () => {
    // "ß".toUpperCase() is "SS": a locale-aware uppercase would turn this into a valid code.
    expect(orderCodeSchema.safeParse(normalizeOrderCode("ABCDßß")).success).toBe(false);
  });
});
