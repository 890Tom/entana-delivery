import { describe, expect, it } from "vitest";
import { resolveOrderLines } from "./resolve-order-lines.js";
import type { OrderableProduct } from "./resolve-order-lines.js";

const FIRST = "3b241101-e2bb-4255-8caf-4136c566a962";
const SECOND = "0190a5b2-7c3d-7e4f-8a1b-2c3d4e5f6a7b";

const product = (id: string, changes: Partial<OrderableProduct> = {}): OrderableProduct => {
  return {
    id,
    name: `Name ${id.slice(0, 4)}`,
    priceAr: 5000,
    active: true,
    available: true,
    ...changes,
  };
};

describe("resolveOrderLines", () => {
  it("takes the name and the price from the products, never from the request", () => {
    const result = resolveOrderLines(
      [{ productId: FIRST, quantity: 3 }],
      [product(FIRST, { name: "Honey", priceAr: 1250 })],
    );

    expect(result).toEqual({
      kind: "resolved",
      lines: [{ productId: FIRST, productName: "Honey", unitPrice: 1250, quantity: 3 }],
    });
  });

  it("matches an upper-case id with the stored one", () => {
    const result = resolveOrderLines(
      [{ productId: FIRST.toUpperCase(), quantity: 1 }],
      [product(FIRST)],
    );

    expect(result.kind).toBe("resolved");
  });

  it.each<[string, OrderableProduct[]]>([
    ["unknown", []],
    ["inactive", [product(FIRST, { active: false })]],
    ["unavailable", [product(FIRST, { available: false })]],
  ])("refuses a %s product and lists its id as sent", (_name, products) => {
    const result = resolveOrderLines([{ productId: FIRST.toUpperCase(), quantity: 1 }], products);

    expect(result).toEqual({ kind: "unusable", productIds: [FIRST.toUpperCase()] });
  });

  it("lists only the unusable ids, in the order of the request", () => {
    const result = resolveOrderLines(
      [
        { productId: SECOND, quantity: 1 },
        { productId: FIRST, quantity: 1 },
      ],
      [product(FIRST, { active: false }), product(SECOND, { available: false })],
    );

    expect(result).toEqual({ kind: "unusable", productIds: [SECOND, FIRST] });
  });
});
