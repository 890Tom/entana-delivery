import type { AdminProduct } from "@entana/contracts";

/** A product of the admin list. The index makes its id, name and reference unique. */
export function buildProduct(index: number, overrides: Partial<AdminProduct> = {}): AdminProduct {
  return {
    id: `0199f5b0-7c1e-7a3b-9d4f-${String(index).padStart(12, "0")}`,
    name: `Produit ${String(index)}`,
    sku: `REF-${String(index).padStart(2, "0")}`,
    priceAr: 1000,
    available: true,
    availabilityChangedAt: "2026-10-01T08:00:00.000Z",
    retired: false,
    position: index,
    ...overrides,
  };
}
