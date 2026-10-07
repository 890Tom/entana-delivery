import { randomUUID } from "node:crypto";
import type { PrismaClient } from "@entana/database";

export interface ProductSeed {
  id?: string;
  name?: string;
  description?: string | null;
  priceAr?: number;
  active?: boolean;
  available?: boolean;
  position?: number;
  imageKey?: string;
  imageAlt?: string;
}

// Satisfies ck_product_photo_when_active (an active row has a photo) and ck_product_price_positive.
// The values are unique per call: the sku is unique in the database and the others make a mix-up visible.
export async function insertProduct(
  database: PrismaClient,
  seed: ProductSeed = {},
): Promise<string> {
  const unique = randomUUID();
  const created = await database.product.create({
    data: {
      name: `Product ${unique}`,
      description: `Description ${unique}`,
      priceAr: 5000,
      active: true,
      available: true,
      position: 0,
      imageKey: `products/${unique}.jpg`,
      imageAlt: `Photo ${unique}`,
      // What the test sets wins over the defaults above.
      ...seed,
      sku: `SKU-${unique}`,
      availabilityChangedAt: new Date("2026-01-01T00:00:00.000Z"),
    },
    select: { id: true },
  });
  return created.id;
}
