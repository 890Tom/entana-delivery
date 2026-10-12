import { describe, expect, it } from "vitest";

import { buildProduct } from "../../../test-support/catalogue/build-product";

import { canReorder, countProducts, visibleProducts } from "./catalogue-view";

const vanille = buildProduct(1, { name: "Vanille", sku: "VAN-01" });
const fraise = buildProduct(2, { name: "Fraise", sku: "FRA-01", available: false });
const chocolat = buildProduct(3, { name: "Chocolat", sku: "CHO-01", retired: true });
const all = [vanille, fraise, chocolat];

describe("the catalogue view", () => {
  it("leaves the retired products out of every tab but their own", () => {
    expect(visibleProducts(all, "all", "")).toEqual([vanille, fraise]);
    expect(visibleProducts(all, "available", "")).toEqual([vanille]);
    expect(visibleProducts(all, "unavailable", "")).toEqual([fraise]);
    expect(visibleProducts(all, "retired", "")).toEqual([chocolat]);
  });

  it("counts the active, unavailable and retired products", () => {
    expect(countProducts(all)).toEqual({ active: 2, unavailable: 1, retired: 1 });
  });

  it("searches the name and the reference, ignoring case and accents", () => {
    const crème = buildProduct(4, { name: "Crème brûlée", sku: "CRE-01" });
    expect(visibleProducts([vanille, crème], "all", "  CREME ")).toEqual([crème]);
    expect(visibleProducts([vanille, crème], "all", "van-0")).toEqual([vanille]);
  });

  it("allows the reordering only on the whole active list", () => {
    expect(canReorder("all", "")).toBe(true);
    expect(canReorder("all", "  ")).toBe(true);
    expect(canReorder("all", "van")).toBe(false);
    expect(canReorder("available", "")).toBe(false);
    expect(canReorder("retired", "")).toBe(false);
  });
});
