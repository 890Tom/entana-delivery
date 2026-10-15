import { z } from "zod";
import { AdminResellerNotFoundError } from "../errors/admin-reseller-errors.js";
import { findReseller } from "../persistence/admin-reseller-queries.js";
import type { AdminResellerDatabase } from "../persistence/admin-reseller-queries.js";
import type { StoredAdminReseller } from "../rules/to-admin-reseller.js";

const resellerIdSchema = z.uuid();

export async function requireReseller(
  database: AdminResellerDatabase,
  id: string,
): Promise<StoredAdminReseller> {
  const reseller = await findReseller(database, id);
  if (reseller === null) {
    throw new AdminResellerNotFoundError();
  }
  return reseller;
}

// A malformed id is the same "not found" as an unknown one, and never reaches the database (a
// uuid column refuses a text that is not one).
export function parseResellerId(id: string): string {
  const parsed = resellerIdSchema.safeParse(id);
  if (!parsed.success) {
    throw new AdminResellerNotFoundError();
  }
  return parsed.data;
}
