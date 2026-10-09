import { MAX_ORDER_LINES, MAX_ORDER_LINE_QUANTITY } from "@entana/contracts";
import { describe, expect, it } from "vitest";

import { buildProductId } from "../../test-support/build-product";

import { cartReducer, emptyCart } from "./cart-reducer";
import type { CartState } from "./cart-reducer";

const A = buildProductId(1);
const B = buildProductId(2);

function cartOf(...lines: [string, number][]): CartState {
  return {
    ...emptyCart(),
    lines: lines.map(([productId, quantity]) => ({ productId, quantity })),
  };
}

describe("cartReducer", () => {
  it("adds a product that is not in the cart with a quantity of 1", () => {
    expect(cartReducer(emptyCart(), { type: "increase", productId: A }).lines).toEqual([
      { productId: A, quantity: 1 },
    ]);
  });

  it("increases the quantity of a product already in the cart", () => {
    expect(cartReducer(cartOf([A, 1]), { type: "increase", productId: A }).lines).toEqual([
      { productId: A, quantity: 2 },
    ]);
  });

  it("decreases the quantity, and removes the line at 1", () => {
    const twice = cartReducer(cartOf([A, 2], [B, 1]), { type: "decrease", productId: A });
    const removed = cartReducer(twice, { type: "decrease", productId: A });

    expect(twice.lines).toEqual([
      { productId: A, quantity: 1 },
      { productId: B, quantity: 1 },
    ]);
    expect(removed.lines).toEqual([{ productId: B, quantity: 1 }]);
  });

  it("never goes above the maximum quantity of a line", () => {
    const full = cartOf([A, MAX_ORDER_LINE_QUANTITY]);

    expect(cartReducer(full, { type: "increase", productId: A })).toBe(full);
  });

  it("refuses a new product once the cart holds the maximum number of products", () => {
    const lines: [string, number][] = Array.from({ length: MAX_ORDER_LINES }, (_unused, index) => [
      buildProductId(index + 10),
      1,
    ]);
    const full = cartOf(...lines);

    expect(cartReducer(full, { type: "increase", productId: A })).toBe(full);
  });

  it("removes the products that are not available and remembers that it did", () => {
    const next = cartReducer(cartOf([A, 2], [B, 1]), {
      type: "removeUnavailable",
      availableIds: new Set([B]),
    });

    expect(next.lines).toEqual([{ productId: B, quantity: 1 }]);
    expect(next.hasRemovedUnavailable).toBe(true);
  });

  it("leaves the cart as it is when every product is available", () => {
    const cart = cartOf([A, 2]);

    expect(cartReducer(cart, { type: "removeUnavailable", availableIds: new Set([A]) })).toBe(cart);
  });
});
