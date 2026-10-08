import type { PublicProduct } from "@entana/contracts";

/** A valid UUID (version 4) that differs per `index`, so lists get stable and unique ids. */
export function buildProductId(index: number): string {
  return `00000000-0000-4000-8000-${index.toString().padStart(12, "0")}`;
}

export function buildProduct(overrides: Partial<PublicProduct> = {}): PublicProduct {
  return {
    id: buildProductId(1),
    name: "Sakafo",
    description: null,
    priceAr: 4500,
    available: true,
    image: { key: "demo/sakafo.jpg", alt: "Photo de sakafo" },
    ...overrides,
  };
}
