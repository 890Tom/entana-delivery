import { publicProductSchema } from "@entana/contracts";
import type { Product } from "@entana/database";
import { describe, expect, it } from "vitest";
import { IncompleteActiveProductError } from "./incomplete-active-product-error.js";
import { toPublicProduct } from "./to-public-product.js";

type CatalogRow = Pick<
  Product,
  "id" | "name" | "description" | "priceAr" | "available" | "imageKey" | "imageAlt"
>;

function buildRow(overrides: Partial<CatalogRow> = {}): CatalogRow {
  return {
    id: "0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b",
    name: "Zebu skewers",
    description: "Grilled over charcoal",
    priceAr: 12000,
    available: true,
    imageKey: "products/zebu-skewers.jpg",
    imageAlt: "Skewers on a grill",
    ...overrides,
  };
}

describe("toPublicProduct", () => {
  it("maps a normal row to a public product", () => {
    expect(toPublicProduct(buildRow())).toEqual({
      id: "0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b",
      name: "Zebu skewers",
      description: "Grilled over charcoal",
      priceAr: 12000,
      available: true,
      image: { key: "products/zebu-skewers.jpg", alt: "Skewers on a grill" },
    });
  });

  it("builds the image from the key and the alt text", () => {
    const product = toPublicProduct(buildRow({ imageKey: "k-1", imageAlt: "alt text 1" }));

    expect(product.image).toEqual({ key: "k-1", alt: "alt text 1" });
  });

  it("keeps a null description null", () => {
    expect(toPublicProduct(buildRow({ description: null })).description).toBeNull();
  });

  it.each([
    ["empty", ""],
    ["spaces", "   "],
    ["tabs and newlines", " \t\n "],
  ])("turns a %s description into null", (_label, description) => {
    expect(toPublicProduct(buildRow({ description })).description).toBeNull();
  });

  it("returns a description with surrounding spaces unchanged", () => {
    expect(toPublicProduct(buildRow({ description: "  padded text \n" })).description).toBe(
      "  padded text \n",
    );
  });

  it("returns the name unchanged", () => {
    expect(toPublicProduct(buildRow({ name: "  Odd  Name " })).name).toBe("  Odd  Name ");
  });

  it("produces output the strict public schema accepts", () => {
    expect(publicProductSchema.safeParse(toPublicProduct(buildRow())).success).toBe(true);
  });

  describe("an active row without a complete photo", () => {
    const secretKey = "secret-key-7f3a";
    const secretAlt = "secret-alt-9c1d";
    const secretName = "secret-name-5b2e";

    function messageOf(row: CatalogRow): string {
      try {
        toPublicProduct(row);
      } catch (error) {
        expect(error).toBeInstanceOf(IncompleteActiveProductError);
        return error instanceof Error ? error.message : "";
      }
      return "";
    }

    it.each([
      ["image key", { imageKey: null, imageAlt: secretAlt }],
      ["image alt", { imageKey: secretKey, imageAlt: null }],
    ])("throws a typed error when the %s is null", (_label, photo) => {
      const row = buildRow({ ...photo, name: secretName });

      expect(() => toPublicProduct(row)).toThrow(IncompleteActiveProductError);
    });

    it.each([
      ["image key", { imageKey: null, imageAlt: secretAlt }],
      ["image alt", { imageKey: secretKey, imageAlt: null }],
    ])("keeps row values out of the message when the %s is null", (_label, photo) => {
      const message = messageOf(buildRow({ ...photo, name: secretName }));

      expect(message).not.toBe("");
      for (const secret of [secretKey, secretAlt, secretName]) {
        expect(message).not.toContain(secret);
      }
    });
  });
});
