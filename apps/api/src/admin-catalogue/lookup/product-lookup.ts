import { z } from "zod";
import { AdminProductNotFoundError } from "../errors/admin-catalogue-errors.js";
import { findProduct } from "../persistence/admin-product-queries.js";
import type { AdminProductDatabase } from "../persistence/admin-product-queries.js";
import type { StoredAdminProduct } from "../rules/to-admin-product.js";

const productIdSchema = z.uuid();

export async function requireProduct(
  database: AdminProductDatabase,
  id: string,
): Promise<StoredAdminProduct> {
  const product = await findProduct(database, id);
  if (product === null) {
    throw new AdminProductNotFoundError();
  }
  return product;
}

// A malformed id is the same "not found" as an unknown one, and never reaches the database (a
// uuid column refuses a text that is not one).
export function parseProductId(id: string): string {
  const parsed = productIdSchema.safeParse(id);
  if (!parsed.success) {
    throw new AdminProductNotFoundError();
  }
  return parsed.data;
}
