import type { PrismaClient } from "@entana/database";
import type { StoredAdminProduct } from "../rules/to-admin-product.js";

/** What the queries need from the client: the PrismaClient and its transaction client both fit. */
export type AdminProductDatabase = Pick<PrismaClient, "product" | "auditLog">;

// An explicit allow-list: the description and the photo are not part of the administration here.
const PRODUCT_SELECT = {
  id: true,
  name: true,
  sku: true,
  priceAr: true,
  available: true,
  availabilityChangedAt: true,
  active: true,
  position: true,
} as const;

/** Every product, retired ones included. The id makes the order total. */
export function listProducts(database: AdminProductDatabase): Promise<StoredAdminProduct[]> {
  return database.product.findMany({
    select: PRODUCT_SELECT,
    orderBy: [{ position: "asc" }, { id: "asc" }],
  });
}

export function findProduct(
  database: AdminProductDatabase,
  id: string,
): Promise<StoredAdminProduct | null> {
  return database.product.findUnique({ where: { id }, select: PRODUCT_SELECT });
}

export async function findActiveProductIds(database: AdminProductDatabase): Promise<string[]> {
  const rows = await database.product.findMany({ where: { active: true }, select: { id: true } });
  return rows.map((row) => row.id);
}

/** The highest position of all the products, or -1 when there is none. */
export async function findLastPosition(database: AdminProductDatabase): Promise<number> {
  const { _max } = await database.product.aggregate({ _max: { position: true } });
  return _max.position ?? -1;
}

// The three changes below are conditional updates: the condition is the state that was read, so a
// concurrent change leaves no row to update, and the caller re-reads to learn why.

/** True when the product is active and had another value. */
export async function setAvailabilityIfActive(
  database: AdminProductDatabase,
  id: string,
  isAvailable: boolean,
  now: Date,
): Promise<boolean> {
  const { count } = await database.product.updateMany({
    where: { id, active: true, available: { not: isAvailable } },
    data: { available: isAvailable, availabilityChangedAt: now },
  });
  return count === 1;
}

/** True when the product was active. */
export async function retireIfActive(database: AdminProductDatabase, id: string): Promise<boolean> {
  const { count } = await database.product.updateMany({
    where: { id, active: true },
    data: { active: false },
  });
  return count === 1;
}

/** True when the product was retired and has its photo (the CHECK would refuse the row). */
export async function restoreIfPossible(
  database: AdminProductDatabase,
  change: { id: string; position: number; now: Date },
): Promise<boolean> {
  const { count } = await database.product.updateMany({
    where: { id: change.id, active: false, imageKey: { not: null }, imageAlt: { not: null } },
    data: {
      active: true,
      available: false,
      availabilityChangedAt: change.now,
      position: change.position,
    },
  });
  return count === 1;
}

export async function setPosition(
  database: AdminProductDatabase,
  id: string,
  position: number,
): Promise<void> {
  await database.product.update({ where: { id }, data: { position }, select: { id: true } });
}

export interface ProductAudit {
  readonly actorId: string;
  readonly action: "product.availability_changed" | "product.retired" | "product.restored";
  readonly productId: string;
  /** Before and after of the changed flag: never a name, a price or personal data. */
  readonly diff: Readonly<Record<string, { readonly from: boolean; readonly to: boolean }>>;
}

export async function insertProductAudit(
  database: AdminProductDatabase,
  audit: ProductAudit,
): Promise<void> {
  await database.auditLog.create({
    data: {
      actorId: audit.actorId,
      action: audit.action,
      entity: "product",
      entityId: audit.productId,
      diff: audit.diff,
    },
    select: { id: true },
  });
}
