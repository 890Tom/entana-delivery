import type { AdminProduct } from "@entana/contracts";

/** A product row as the queries select it. */
export interface StoredAdminProduct {
  readonly id: string;
  readonly name: string;
  readonly sku: string;
  readonly priceAr: number;
  readonly available: boolean;
  readonly availabilityChangedAt: Date;
  readonly active: boolean;
  readonly position: number;
}

/** `retired` is the negation of `active`: the column keeps its meaning for the public catalogue. */
export function toAdminProduct(row: StoredAdminProduct): AdminProduct {
  return {
    id: row.id,
    name: row.name,
    sku: row.sku,
    priceAr: row.priceAr,
    available: row.available,
    availabilityChangedAt: row.availabilityChangedAt.toISOString(),
    retired: !row.active,
    position: row.position,
  };
}
