import type { PublicProduct } from "@entana/contracts";
import type { Product } from "@entana/database";
import { IncompleteActiveProductError } from "../errors/incomplete-active-product-error.js";
import { toProductImageUrl } from "./to-product-image-url.js";

/** The columns the public catalogue reads: sku and the other internal fields are not among them. */
export type CatalogRow = Pick<
  Product,
  "id" | "name" | "description" | "priceAr" | "available" | "imageKey" | "imageAlt"
>;

// A description is returned as it is, never trimmed: only a blank one is dropped.
function toDescription(description: string | null): string | null {
  return description === null || !/\S/.test(description) ? null : description;
}

/**
 * Maps a row of an active product to its public shape. A row without a photo cannot exist
 * (CHECK), so it is an error, never a row to skip silently. The raw image key stays here.
 */
export function toPublicProduct(row: CatalogRow): PublicProduct {
  if (row.imageKey === null || row.imageAlt === null) {
    throw new IncompleteActiveProductError();
  }
  return {
    id: row.id,
    name: row.name,
    description: toDescription(row.description),
    priceAr: row.priceAr,
    available: row.available,
    image: { url: toProductImageUrl(row.imageKey), alt: row.imageAlt },
  };
}
