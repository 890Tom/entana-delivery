import { afterEach, describe, expect, it, vi } from "vitest";

import { buildProductId } from "../../../test-support/build-product";

import { CART_STORAGE_KEY, readStoredCart, writeStoredCart } from "./cart-storage";

const LINES = [
  { productId: buildProductId(1), quantity: 2 },
  { productId: buildProductId(2), quantity: 99 },
];

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe("the stored cart", () => {
  it("is read back exactly as it was written", () => {
    writeStoredCart(LINES);

    expect(readStoredCart()).toEqual(LINES);
  });

  it("keeps only identifiers and quantities under a versioned key", () => {
    writeStoredCart(LINES);

    expect(CART_STORAGE_KEY).toBe("entana.cart.v1");
    expect(JSON.parse(localStorage.getItem(CART_STORAGE_KEY) ?? "null")).toEqual({
      version: 1,
      lines: LINES,
    });
  });

  it.each([
    ["nothing", null],
    ["text that is not JSON", "{not json"],
    ["another version", JSON.stringify({ version: 2, lines: LINES })],
    [
      "a quantity out of bounds",
      JSON.stringify({ version: 1, lines: [{ ...LINES[0], quantity: 100 }] }),
    ],
    [
      "a field that is not expected",
      JSON.stringify({ version: 1, lines: [{ ...LINES[0], price: 1 }] }),
    ],
    ["a product twice", JSON.stringify({ version: 1, lines: [LINES[0], LINES[0]] })],
    [
      "a text over the size limit",
      `${JSON.stringify({ version: 1, lines: LINES })}${" ".repeat(9000)}`,
    ],
  ])("gives an empty cart for %s", (_label, stored) => {
    if (stored !== null) {
      localStorage.setItem(CART_STORAGE_KEY, stored);
    }

    expect(readStoredCart()).toEqual([]);
  });

  it("does not fail when the storage is unavailable", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("denied", "SecurityError");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("full", "QuotaExceededError");
    });

    expect(readStoredCart()).toEqual([]);
    expect(() => {
      writeStoredCart(LINES);
    }).not.toThrow();
  });
});
