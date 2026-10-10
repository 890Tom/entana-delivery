import { describe, expect, it } from "vitest";
import { operatorPrefixes } from "./operator-prefixes.js";

describe("operatorPrefixes", () => {
  it("lists the mobile prefixes of the plan of Madagascar", () => {
    expect(operatorPrefixes("261")).toEqual(["32", "33", "34", "37", "38", "39"]);
  });

  it("gives nothing for a country without a rule, or for a key that is not a country", () => {
    expect(operatorPrefixes("33")).toEqual([]);
    expect(operatorPrefixes("constructor")).toEqual([]);
  });

  it("gives a list that a caller cannot change", () => {
    expect(Object.isFrozen(operatorPrefixes("261"))).toBe(true);
  });
});
