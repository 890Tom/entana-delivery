import { describe, expect, it } from "vitest";
import { createProductRequestSchema, updateProductRequestSchema } from "./product-form.js";

const VALID = { name: "Savon", priceAr: 4500, sku: "SAV-001" };

describe("createProductRequestSchema", () => {
  it("applies the default: available", () => {
    const parsed = createProductRequestSchema.parse(VALID);

    expect(parsed).toEqual({ ...VALID, available: true });
  });

  it("normalises the sku (trim, upper case) and turns an empty description into null", () => {
    const parsed = createProductRequestSchema.parse({
      ...VALID,
      sku: "  sav-001 ",
      description: "  ",
    });

    expect(parsed.sku).toBe("SAV-001");
    expect(parsed.description).toBeNull();
  });

  it.each([
    ["an empty name", { name: "" }],
    ["a name of 61 characters", { name: "x".repeat(61) }],
    ["a price of 0", { priceAr: 0 }],
    ["a price over 1 000 000", { priceAr: 1_000_001 }],
    ["a price with decimals", { priceAr: 10.5 }],
    ["a sku that starts with a dash", { sku: "-AB" }],
    ["a sku of one character", { sku: "A" }],
    ["a sku of 21 characters", { sku: "A".repeat(21) }],
    ["a sku with a space inside", { sku: "AB CD" }],
    ["a description of 121 characters", { description: "x".repeat(121) }],
    ["an empty imageAlt", { imageAlt: " " }],
    ["an imageAlt of 151 characters", { imageAlt: "x".repeat(151) }],
    ["a field in excess", { color: "red" }],
    ["retired, which a creation does not take", { retired: false }],
  ])("refuses %s", (_label, override) => {
    expect(createProductRequestSchema.safeParse({ ...VALID, ...override }).success).toBe(false);
  });

  it("accepts the bounds", () => {
    const edge = {
      name: "x".repeat(60),
      priceAr: 1_000_000,
      sku: "A".repeat(20),
      description: "x".repeat(120),
      imageAlt: "x".repeat(150),
    };

    expect(createProductRequestSchema.safeParse(edge).success).toBe(true);
  });
});

describe("updateProductRequestSchema", () => {
  it("accepts one field and keeps the absent ones absent", () => {
    expect(updateProductRequestSchema.parse({ priceAr: 10 })).toEqual({ priceAr: 10 });
  });

  it("refuses an empty object and a field in excess", () => {
    expect(updateProductRequestSchema.safeParse({}).success).toBe(false);
    expect(updateProductRequestSchema.safeParse({ priceAr: 1, id: "x" }).success).toBe(false);
  });

  it("accepts an empty description, which clears it", () => {
    expect(updateProductRequestSchema.parse({ description: "" })).toEqual({ description: null });
  });

  it("applies the same bounds as the creation", () => {
    expect(updateProductRequestSchema.safeParse({ sku: "a b" }).success).toBe(false);
    expect(updateProductRequestSchema.safeParse({ name: "" }).success).toBe(false);
  });
});
