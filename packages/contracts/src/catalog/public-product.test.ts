import { describe, expect, it } from "vitest";
import type { PublicProduct } from "./public-product.js";
import { publicProductSchema } from "./public-product.js";

const UUID_V4 = "3f2b8c1e-5d4a-4b6c-9e7f-0a1b2c3d4e5f";
const UUID_V7 = "018f3b0e-7c1a-7d3e-8a45-1b2c3d4e5f60";

function buildProduct(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: UUID_V4,
    name: "Demo Product Alpha",
    description: "A fake product for the demo.",
    priceAr: 4500,
    available: true,
    image: { url: "/media/products/placeholder-alpha.jpg", alt: "Placeholder picture of Alpha" },
    ...overrides,
  };
}

function buildProductWithout(key: string): Record<string, unknown> {
  return Object.fromEntries(Object.entries(buildProduct()).filter(([name]) => name !== key));
}

function isAccepted(value: unknown): boolean {
  return publicProductSchema.safeParse(value).success;
}

describe("publicProductSchema", () => {
  describe("accepts", () => {
    it("a complete product with a description", () => {
      expect(isAccepted(buildProduct())).toBe(true);
    });

    it("a product with a null description", () => {
      expect(isAccepted(buildProduct({ description: null }))).toBe(true);
    });

    it("a product with an empty description", () => {
      expect(isAccepted(buildProduct({ description: "" }))).toBe(true);
    });

    it("a product without a photo file (null url) and its alt text", () => {
      expect(isAccepted(buildProduct({ image: { url: null, alt: "Alt" } }))).toBe(true);
    });

    it("a product that is not available", () => {
      expect(isAccepted(buildProduct({ available: false }))).toBe(true);
    });

    it("a version 4 uuid", () => {
      expect(isAccepted(buildProduct({ id: UUID_V4 }))).toBe(true);
    });

    it("a version 7 uuid", () => {
      expect(isAccepted(buildProduct({ id: UUID_V7 }))).toBe(true);
    });

    it("the smallest price, 1 ariary", () => {
      expect(isAccepted(buildProduct({ priceAr: 1 }))).toBe(true);
    });

    it("an upper-case uuid", () => {
      expect(isAccepted(buildProduct({ id: UUID_V7.toUpperCase() }))).toBe(true);
    });

    it("the largest safe integer as a price", () => {
      expect(isAccepted(buildProduct({ priceAr: Number.MAX_SAFE_INTEGER }))).toBe(true);
    });

    it("a name with surrounding spaces, and returns it unchanged", () => {
      const input = buildProduct({ name: "  Spaced name  " });

      const result = publicProductSchema.safeParse(input);

      expect(result.success).toBe(true);
      expect(result.data).toStrictEqual(input);
    });
  });

  describe("refuses", () => {
    it("a product carrying the internal sku", () => {
      expect(isAccepted(buildProduct({ sku: "DEMO-SKU-001" }))).toBe(false);
    });

    it.each([
      ["position", { position: 1 }],
      ["active", { active: true }],
      ["availabilityChangedAt", { availabilityChangedAt: "2026-10-07T00:00:00Z" }],
      ["an unknown property", { colour: "red" }],
    ])("a product with the extra property %s", (_label, extra) => {
      expect(isAccepted(buildProduct(extra))).toBe(false);
    });

    it("an image carrying an extra property", () => {
      const image = { url: null, alt: "Alt", key: "placeholder-alpha.jpg" };

      expect(isAccepted(buildProduct({ image }))).toBe(false);
    });

    it.each(["id", "name", "priceAr", "available", "image"])("a product without %s", (key) => {
      expect(isAccepted(buildProductWithout(key))).toBe(false);
    });

    it.each([
      ["zero", 0],
      ["negative", -1],
      ["a decimal", 12.5],
      ["a numeric string", "4500"],
      ["NaN", Number.NaN],
      ["Infinity", Number.POSITIVE_INFINITY],
      ["an unsafe integer", Number.MAX_SAFE_INTEGER + 1],
      ["1e21", 1e21],
    ])("a priceAr that is %s", (_label, priceAr) => {
      expect(isAccepted(buildProduct({ priceAr }))).toBe(false);
    });

    it.each([
      ["empty", ""],
      ["only spaces", "   "],
      ["only a tab and a newline", "\t\n"],
      ["only a non-breaking space", "\u00a0"],
    ])("a name that is %s", (_label, name) => {
      expect(isAccepted(buildProduct({ name }))).toBe(false);
    });

    it("a name that is not a string", () => {
      expect(isAccepted(buildProduct({ name: 42 }))).toBe(false);
    });

    it("a blank name with the message that names the rule", () => {
      const result = publicProductSchema.safeParse(buildProduct({ name: "  " }));

      expect(result.error?.issues[0]?.message).toBe("must contain a non-whitespace character");
    });

    it.each([
      ["an empty alt", { url: null, alt: "" }],
      ["a whitespace-only alt", { url: null, alt: "  " }],
      ["a missing url", { alt: "Alt" }],
      ["a missing alt", { url: null }],
      ["a numeric url", { url: 42, alt: "Alt" }],
      ["a null alt", { url: null, alt: null }],
    ])("an image with %s", (_label, image) => {
      expect(isAccepted(buildProduct({ image }))).toBe(false);
    });

    it.each([
      ["an absolute URL", "https://example.test/media/products/a.jpg"],
      ["a protocol-relative URL", "//example.test/media/products/a.jpg"],
      ["another media folder", "/media/branding/a.jpg"],
      ["a bare file name", "a.jpg"],
      ["a file in a sub-folder", "/media/products/sub/a.jpg"],
      ["a svg file", "/media/products/a.svg"],
      ["a parent folder", "/media/products/../a.jpg"],
    ])("an image url that is %s", (_label, url) => {
      expect(isAccepted(buildProduct({ image: { url, alt: "Alt" } }))).toBe(false);
    });

    it.each([
      ["null", null],
      ["a string", "/media/products/a.jpg"],
      ["an array", []],
    ])("an image that is %s", (_label, image) => {
      expect(isAccepted(buildProduct({ image }))).toBe(false);
    });

    it("a product without a description key", () => {
      expect(isAccepted(buildProductWithout("description"))).toBe(false);
    });

    it.each([
      ["a string", "true"],
      ["a number", 1],
      ["null", null],
    ])("an available flag that is %s", (_label, available) => {
      expect(isAccepted(buildProduct({ available }))).toBe(false);
    });

    it.each([
      ["not a uuid", "not-a-uuid"],
      ["an empty string", ""],
      ["a number", 7],
      ["a uuid with a wrong variant", "3f2b8c1e-5d4a-4b6c-1e7f-0a1b2c3d4e5f"],
      ["a uuid of version 0", "3f2b8c1e-5d4a-0b6c-9e7f-0a1b2c3d4e5f"],
      ["a uuid of version 9", "3f2b8c1e-5d4a-9b6c-9e7f-0a1b2c3d4e5f"],
    ])("an id that is %s", (_label, id) => {
      expect(isAccepted(buildProduct({ id }))).toBe(false);
    });

    it.each([
      ["a number", 12],
      ["undefined", undefined],
      ["an object", {}],
    ])("a description that is %s", (_label, description) => {
      expect(isAccepted(buildProduct({ description }))).toBe(false);
    });
  });

  it("exposes exactly the allow-listed product keys", () => {
    expect(Object.keys(publicProductSchema.shape).sort()).toStrictEqual(
      ["available", "description", "id", "image", "name", "priceAr"].sort(),
    );
  });

  it("exposes exactly the allow-listed image fields", () => {
    expect(Object.keys(publicProductSchema.shape.image.shape).sort()).toStrictEqual(["alt", "url"]);
  });

  it("infers the public product type from the schema", () => {
    const product: PublicProduct = {
      id: UUID_V7,
      name: "Demo Product Alpha",
      description: null,
      priceAr: 4500,
      available: true,
      image: { url: "/media/products/placeholder-alpha.jpg", alt: "Placeholder picture of Alpha" },
    };

    expect(isAccepted(product)).toBe(true);
  });
});
