import { describe, expect, it } from "vitest";
import { computeOrderTotal } from "./order-total.ts";

describe("computeOrderTotal", () => {
  it("adds the items and the delivery fee", () => {
    const lines = [
      { qty: 2, unitPrice: 4500 },
      { qty: 1, unitPrice: 5000 },
    ];
    expect(computeOrderTotal(lines, 3000)).toBe(17_000);
  });

  it("is the delivery fee alone without items", () => {
    expect(computeOrderTotal([], 3000)).toBe(3000);
  });

  it("allows a free delivery", () => {
    expect(computeOrderTotal([{ qty: 3, unitPrice: 1000 }], 0)).toBe(3000);
  });

  it.each([-1, 1.5, Number.NaN])("rejects the delivery fee %s", (fee) => {
    expect(() => computeOrderTotal([], fee)).toThrow(RangeError);
  });

  it.each([0, -1, 1.5])("rejects the quantity %s", (qty) => {
    expect(() => computeOrderTotal([{ qty, unitPrice: 1000 }], 0)).toThrow(RangeError);
  });

  it.each([-1, 0.5])("rejects the unit price %s", (unitPrice) => {
    expect(() => computeOrderTotal([{ qty: 1, unitPrice }], 0)).toThrow(RangeError);
  });
});
