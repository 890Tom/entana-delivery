import { publicProductSchema } from "@entana/contracts";
import { describe, expect, it } from "vitest";
import { InvalidProductImageKeyError } from "../errors/invalid-product-image-key-error.js";
import { IncompleteActiveProductError } from "../errors/incomplete-active-product-error.js";
import { toPublicProduct } from "./to-public-product.js";
import type { CatalogRow } from "./to-public-product.js";

function buildRow(overrides: Partial<CatalogRow> = {}): CatalogRow {
  return {
    id: "0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b",
    name: "Zebu skewers",
    description: "Grilled over charcoal",
    priceAr: 12000,
    available: true,
    imageKey: "zebu-skewers.jpg",
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
      image: { url: "/media/products/zebu-skewers.jpg", alt: "Skewers on a grill" },
    });
  });

  it("maps whatever key and alt text the row holds (no value hard-coded)", () => {
    const product = toPublicProduct(buildRow({ imageKey: "k-1.png", imageAlt: "alt text 1" }));

    expect(product.image).toEqual({ url: "/media/products/k-1.png", alt: "alt text 1" });
  });

  it("does not expose the raw image key", () => {
    const product = toPublicProduct(buildRow({ imageKey: "zebu-skewers.jpg" }));

    expect(Object.keys(product.image).sort()).toEqual(["alt", "url"]);
  });

  it("lets the typed error of an invalid image key reach the caller", () => {
    expect(() => toPublicProduct(buildRow({ imageKey: "products/zebu.jpg" }))).toThrow(
      InvalidProductImageKeyError,
    );
  });

  it("keeps a null description null", () => {
    expect(toPublicProduct(buildRow({ description: null })).description).toBeNull();
  });

  it.each([
    ["empty", ""],
    ["spaces", "   "],
    ["tabs and newlines", " \t\n "],
    // \S treats these as white space too: a description made of them is blank.
    ["non-breaking spaces", "\u00a0\u00a0"],
    ["ideographic spaces", "\u3000"],
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
    const product = toPublicProduct(buildRow());

    expect(publicProductSchema.parse(product)).toEqual(product);
  });

  describe("an active row without a complete photo", () => {
    const secretKey = "secret-key-7f3a";
    const secretAlt = "secret-alt-9c1d";
    const secretName = "secret-name-5b2e";

    function thrownBy(row: CatalogRow): unknown {
      try {
        toPublicProduct(row);
      } catch (error) {
        return error;
      }
      return undefined;
    }

    it.each([
      ["image key", { imageKey: null, imageAlt: secretAlt }],
      ["image alt", { imageKey: secretKey, imageAlt: null }],
      ["image key and alt", { imageKey: null, imageAlt: null }],
    ])("throws a typed error when the %s is null", (_label, photo) => {
      const row = buildRow({ ...photo, name: secretName });

      expect(() => toPublicProduct(row)).toThrow(IncompleteActiveProductError);
    });

    it.each([
      ["image key", { imageKey: null, imageAlt: secretAlt }],
      ["image alt", { imageKey: secretKey, imageAlt: null }],
      ["image key and alt", { imageKey: null, imageAlt: null }],
    ])("keeps row values out of the message when the %s is null", (_label, photo) => {
      const failure = thrownBy(buildRow({ ...photo, name: secretName }));

      expect(failure).toBeInstanceOf(IncompleteActiveProductError);
      const message = failure instanceof Error ? failure.message : "";
      for (const secret of [secretKey, secretAlt, secretName]) {
        expect(message).not.toContain(secret);
      }
    });
  });
});
