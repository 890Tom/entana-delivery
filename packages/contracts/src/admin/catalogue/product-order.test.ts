import { describe, expect, it } from "vitest";
import { isCompleteProductOrder } from "./product-order.js";

const A = "0199f5b0-7c1e-7a3b-9d4f-2b6e8a1c3d5a";
const B = "0199f5b0-7c1e-7a3b-9d4f-2b6e8a1c3d5b";
const C = "0199f5b0-7c1e-7a3b-9d4f-2b6e8a1c3d5c";

describe("isCompleteProductOrder", () => {
  it("accepts the same set in another order", () => {
    expect(isCompleteProductOrder([C, A, B], [A, B, C])).toBe(true);
  });

  it("compares a uuid in lower case", () => {
    expect(isCompleteProductOrder([A.toUpperCase()], [A])).toBe(true);
  });

  it("accepts an empty list when no product is active", () => {
    expect(isCompleteProductOrder([], [])).toBe(true);
  });

  it.each([
    ["a missing product", [A, B], [A, B, C]],
    ["a product that is not active", [A, B, C], [A, B]],
    ["a duplicate that keeps the right length", [A, A], [A, B]],
    ["a duplicate on top of the set", [A, B, B], [A, B]],
  ])("refuses %s", (_label, ids, activeIds) => {
    expect(isCompleteProductOrder(ids, activeIds)).toBe(false);
  });
});
