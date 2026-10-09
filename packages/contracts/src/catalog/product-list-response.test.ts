import { describe, expect, it } from "vitest";
import type { ProductListResponse } from "./product-list-response.js";
import { productListResponseSchema } from "./product-list-response.js";

function buildProduct(id: string, name: string): Record<string, unknown> {
  return {
    id,
    name,
    description: null,
    priceAr: 4500,
    available: true,
    image: { url: `/media/products/${name}.jpg`, alt: `Picture of ${name}` },
  };
}

const FIRST = buildProduct("3f2b8c1e-5d4a-4b6c-9e7f-0a1b2c3d4e5f", "first");
const SECOND = buildProduct("018f3b0e-7c1a-7d3e-8a45-1b2c3d4e5f60", "second");

function isAccepted(value: unknown): boolean {
  return productListResponseSchema.safeParse(value).success;
}

describe("productListResponseSchema", () => {
  it("accepts an empty list", () => {
    expect(isAccepted({ products: [] })).toBe(true);
  });

  it("accepts a list of two products and keeps their order", () => {
    const result = productListResponseSchema.safeParse({ products: [SECOND, FIRST] });

    expect(result.data?.products.map((product) => product.name)).toStrictEqual(["second", "first"]);
  });

  it("refuses a bare array instead of the object", () => {
    expect(isAccepted([FIRST])).toBe(false);
  });

  it("refuses an object without products", () => {
    expect(isAccepted({})).toBe(false);
  });

  it.each([
    ["an object", {}],
    ["a string", "products"],
    ["null", null],
  ])("refuses products that is %s", (_label, products) => {
    expect(isAccepted({ products })).toBe(false);
  });

  it.each([
    ["null", null],
    ["a string", "x"],
    ["a number", 1],
  ])("refuses a list containing %s instead of a product", (_label, element) => {
    expect(isAccepted({ products: [element] })).toBe(false);
  });

  it("refuses an extra property next to products", () => {
    expect(isAccepted({ products: [], total: 0 })).toBe(false);
  });

  it("refuses a list containing an invalid product", () => {
    expect(isAccepted({ products: [FIRST, { ...SECOND, priceAr: 0 }] })).toBe(false);
  });

  it("refuses a list containing a product with the internal sku", () => {
    expect(isAccepted({ products: [{ ...FIRST, sku: "DEMO-SKU-001" }] })).toBe(false);
  });

  it("exposes exactly the products key", () => {
    expect(Object.keys(productListResponseSchema.shape)).toStrictEqual(["products"]);
  });

  it("infers the list response type from the schema", () => {
    const response: ProductListResponse = { products: [] };

    expect(isAccepted(response)).toBe(true);
  });
});
