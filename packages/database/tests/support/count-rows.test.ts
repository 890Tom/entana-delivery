import { describe, expect, it } from "vitest";
import { findChangedTables } from "./count-rows.js";

describe("findChangedTables", () => {
  it("reports no difference for equal counts", () => {
    expect(findChangedTables({ customer: 2, product: 1 }, { customer: 2, product: 1 })).toEqual([]);
  });

  it.each([
    ["a row added", { customer: 3 }, ["customer"]],
    ["a row removed", { customer: 1 }, ["customer"]],
    ["a table that disappeared", {}, ["customer"]],
    ["a table that appeared", { customer: 2, extra: 0 }, ["extra"]],
  ])("reports %s", (_label, after, expected) => {
    expect(findChangedTables({ customer: 2 }, after)).toEqual(expected);
  });
});
