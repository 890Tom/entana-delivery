import { describe, expect, it } from "vitest";

import { buildProduct } from "../../../test-support/catalogue/build-product";

import {
  buildCreateBody,
  buildUpdateBody,
  canPublish,
  emptyProductForm,
  formValuesOf,
  planVisibilityChange,
  readPriceInput,
  showPriceInput,
  validateProductForm,
} from "./product-form";
import type { ProductFormValues } from "./product-form";

const valid: ProductFormValues = {
  ...emptyProductForm(),
  name: "Mangue",
  price: "1200",
  sku: "MAN-01",
};

describe("validateProductForm", () => {
  it("accepts a complete form", () => {
    expect(validateProductForm(valid, false)).toEqual({});
  });

  it("refuses an empty name", () => {
    expect(validateProductForm({ ...valid, name: "  " }, false)).toEqual({ name: "name" });
  });

  it.each(["", "0", "1000001"])("refuses the price %j", (price) => {
    expect(validateProductForm({ ...valid, price }, false)).toEqual({ price: "price" });
  });

  it("refuses a reference with a space", () => {
    expect(validateProductForm({ ...valid, sku: "MAN 01" }, false)).toEqual({ sku: "sku" });
  });

  it("asks for the alternative text once a photo exists", () => {
    expect(validateProductForm(valid, true)).toEqual({ imageAlt: "imageAlt" });
    expect(validateProductForm({ ...valid, imageAlt: "Une mangue" }, true)).toEqual({});
  });
});

describe("the price field", () => {
  it("keeps the digits only, at most seven, and groups them with no-break spaces", () => {
    expect(readPriceInput("1 2a00 000 9")).toBe("1200000");
    expect(showPriceInput("1200000")).toBe("1\u00a0200\u00a0000");
  });
});

describe("canPublish", () => {
  it("needs a photo and its alternative text", () => {
    expect(canPublish({ ...valid, imageAlt: "Une mangue" }, true)).toBe(true);
    expect(canPublish({ ...valid, imageAlt: "Une mangue" }, false)).toBe(false);
    expect(canPublish(valid, true)).toBe(false);
  });
});

describe("buildCreateBody", () => {
  it("normalises the texts and leaves out what is empty", () => {
    expect(buildCreateBody({ ...valid, name: " Mangue ", sku: " man-01 " })).toEqual({
      name: "Mangue",
      priceAr: 1200,
      sku: "MAN-01",
      available: true,
    });
  });
});

describe("buildUpdateBody", () => {
  const product = buildProduct(1, {
    name: "Mangue",
    priceAr: 1200,
    sku: "MAN-01",
    description: "Fruitée",
    imageAlt: "Une mangue",
  });

  it("holds only the changed fields", () => {
    const values = { ...formValuesOf(product), price: "1500", isAvailable: false };

    expect(buildUpdateBody(values, product)).toEqual({ priceAr: 1500, available: false });
  });

  it("clears the description with an empty text", () => {
    const values = { ...formValuesOf(product), description: " " };

    expect(buildUpdateBody(values, product)).toEqual({ description: "" });
  });

  it("is null when nothing but the visibility changes", () => {
    const values = { ...formValuesOf(product), isVisible: false };

    expect(buildUpdateBody(values, product)).toBeNull();
  });
});

describe("planVisibilityChange", () => {
  const retired = buildProduct(2, { retired: true });

  it("is null when the visibility is the server's", () => {
    expect(planVisibilityChange(formValuesOf(retired), retired)).toBeNull();
    expect(planVisibilityChange(valid, null)).toBeNull();
  });

  it("publishes a new or a retired product, and retires a visible one", () => {
    expect(planVisibilityChange({ ...valid, isVisible: true }, null)).toEqual({ retired: false });
    expect(planVisibilityChange({ ...formValuesOf(retired), isVisible: true }, retired)).toEqual({
      retired: false,
    });
    const visible = buildProduct(3);
    expect(planVisibilityChange({ ...formValuesOf(visible), isVisible: false }, visible)).toEqual({
      retired: true,
    });
  });
});
