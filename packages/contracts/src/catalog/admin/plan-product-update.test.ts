import { describe, expect, it } from "vitest";
import { planProductUpdate } from "./plan-product-update.js";
import type { ProductState } from "./plan-product-update.js";

const ACTIVE: ProductState = {
  name: "Savon",
  sku: "SAV-1",
  priceAr: 4500,
  description: "Un savon",
  imageAlt: "Un savon blanc",
  imageKey: "a.webp",
  available: true,
  active: true,
};
const RETIRED: ProductState = { ...ACTIVE, active: false, available: true };
const RETIRED_WITHOUT_PHOTO: ProductState = { ...RETIRED, imageKey: null, imageAlt: null };

describe("planProductUpdate", () => {
  it("is unchanged when every value is the current one", () => {
    const plan = planProductUpdate(ACTIVE, { name: "Savon", priceAr: 4500, retired: false });

    expect(plan).toEqual({ kind: "unchanged" });
  });

  it("lists the changed fields and the price before and after, not the ones that match", () => {
    const plan = planProductUpdate(ACTIVE, { name: "Savon bio", priceAr: 5000, sku: "SAV-1" });

    expect(plan).toMatchObject({
      kind: "changed",
      columns: { name: "Savon bio", priceAr: 5000 },
      fields: ["name", "priceAr"],
      price: { from: 4500, to: 5000 },
      availability: null,
      lifecycle: null,
    });
  });

  it("clears the description with null", () => {
    const plan = planProductUpdate(ACTIVE, { description: null });

    expect(plan).toMatchObject({ kind: "changed", columns: { description: null } });
  });

  it("reports an availability change apart from the other fields", () => {
    const plan = planProductUpdate(ACTIVE, { available: false });

    expect(plan).toMatchObject({
      kind: "changed",
      fields: [],
      availability: { from: true, to: false },
    });
  });

  it("allows the availability of a retired product to change", () => {
    const plan = planProductUpdate(RETIRED, { available: false });

    expect(plan).toMatchObject({ kind: "changed", availability: { from: true, to: false } });
  });

  it("restores a retired product as unavailable when available is not sent", () => {
    const plan = planProductUpdate(RETIRED, { retired: false });

    expect(plan).toMatchObject({
      kind: "changed",
      columns: { active: true, available: false },
      lifecycle: "restored",
      availability: { from: true, to: false },
    });
  });

  it("restores with the available that the request sends", () => {
    const plan = planProductUpdate(RETIRED, { retired: false, available: true });

    expect(plan).toMatchObject({
      kind: "changed",
      columns: { active: true, available: true },
      lifecycle: "restored",
      availability: null,
    });
  });

  it("retires an active product and keeps its availability", () => {
    const plan = planProductUpdate(ACTIVE, { retired: true });

    expect(plan).toMatchObject({
      kind: "changed",
      columns: { active: false },
      lifecycle: "retired",
    });
  });

  it("refuses to make a product visible without a photo", () => {
    expect(planProductUpdate(RETIRED_WITHOUT_PHOTO, { retired: false })).toEqual({
      kind: "not_publishable",
    });
  });

  it("refuses to make a product visible with a photo and no alternative text", () => {
    const state: ProductState = { ...RETIRED, imageAlt: null };

    expect(planProductUpdate(state, { retired: false })).toEqual({ kind: "not_publishable" });
  });

  it("publishes a product whose request brings the missing alternative text", () => {
    const state: ProductState = { ...RETIRED, imageAlt: null };

    const plan = planProductUpdate(state, { retired: false, imageAlt: "Un savon" });

    expect(plan).toMatchObject({ kind: "changed", lifecycle: "restored" });
  });

  it("lets a retired product without photo change its other fields", () => {
    const plan = planProductUpdate(RETIRED_WITHOUT_PHOTO, { name: "Autre", retired: true });

    expect(plan).toMatchObject({ kind: "changed", fields: ["name"], lifecycle: null });
  });
});
