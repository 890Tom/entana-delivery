import { describe, expect, it } from "vitest";
import { computeOrderTotal } from "./compute-order-total.js";

describe("computeOrderTotal", () => {
  it("adds the lines and the delivery fee", () => {
    const lines = [
      { unitPrice: 12_000, quantity: 2 },
      { unitPrice: 5_500, quantity: 3 },
    ];
    expect(computeOrderTotal(lines, 3_000)).toBe(43_500);
  });

  it("accepts a delivery fee of 0", () => {
    expect(computeOrderTotal([{ unitPrice: 8_000, quantity: 1 }], 0)).toBe(8_000);
  });

  it("accepts a free product", () => {
    expect(computeOrderTotal([{ unitPrice: 0, quantity: 4 }], 2_000)).toBe(2_000);
  });

  it("does not modify the lines it is given", () => {
    const lines = [{ unitPrice: 100, quantity: 2 }];
    computeOrderTotal(lines, 50);
    expect(lines).toEqual([{ unitPrice: 100, quantity: 2 }]);
  });

  it("accepts a total of exactly Number.MAX_SAFE_INTEGER", () => {
    const lines = [{ unitPrice: Number.MAX_SAFE_INTEGER - 5, quantity: 1 }];
    expect(computeOrderTotal(lines, 5)).toBe(Number.MAX_SAFE_INTEGER);
  });

  it("rejects a total one above Number.MAX_SAFE_INTEGER", () => {
    const lines = [{ unitPrice: Number.MAX_SAFE_INTEGER - 5, quantity: 1 }];
    expect(() => computeOrderTotal(lines, 6)).toThrow(RangeError);
  });

  it("rejects a sum of lines above Number.MAX_SAFE_INTEGER", () => {
    const lines = [
      { unitPrice: Number.MAX_SAFE_INTEGER, quantity: 1 },
      { unitPrice: 1, quantity: 1 },
    ];
    expect(() => computeOrderTotal(lines, 0)).toThrow(RangeError);
  });

  it("rejects a line whose price times quantity is above Number.MAX_SAFE_INTEGER", () => {
    expect(() => computeOrderTotal([{ unitPrice: 2 ** 40, quantity: 2 ** 20 }], 0)).toThrow(
      RangeError,
    );
  });

  it("rejects an empty list of lines", () => {
    expect(() => computeOrderTotal([], 1_000)).toThrow(RangeError);
  });

  it.each([
    ["a decimal unit price", [{ unitPrice: 10.5, quantity: 1 }], 0],
    ["a negative unit price", [{ unitPrice: -1, quantity: 1 }], 0],
    ["a NaN unit price", [{ unitPrice: Number.NaN, quantity: 1 }], 0],
    ["an infinite unit price", [{ unitPrice: Number.POSITIVE_INFINITY, quantity: 1 }], 0],
    ["a decimal quantity", [{ unitPrice: 10, quantity: 1.5 }], 0],
    ["a negative quantity", [{ unitPrice: 10, quantity: -1 }], 0],
    ["a quantity of 0", [{ unitPrice: 10, quantity: 0 }], 0],
    ["an infinite quantity", [{ unitPrice: 10, quantity: Number.POSITIVE_INFINITY }], 0],
    ["a decimal delivery fee", [{ unitPrice: 10, quantity: 1 }], 0.5],
    ["a negative delivery fee", [{ unitPrice: 10, quantity: 1 }], -1],
    ["a NaN delivery fee", [{ unitPrice: 10, quantity: 1 }], Number.NaN],
    ["an infinite delivery fee", [{ unitPrice: 10, quantity: 1 }], Number.POSITIVE_INFINITY],
  ])("rejects %s", (_label, lines, fee) => {
    expect(() => computeOrderTotal(lines, fee)).toThrow(RangeError);
  });
});
