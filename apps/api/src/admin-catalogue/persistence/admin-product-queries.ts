import type { PrismaClient } from "@entana/database";
import type { StoredAdminProduct } from "../rules/to-admin-product.js";

/** What the queries need from the client: the PrismaClient and its transaction client both fit. */
export type AdminProductDatabase = Pick<PrismaClient, "product" | "auditLog">;

// An explicit allow-list of the columns the form reads and shows.
const PRODUCT_SELECT = {
  id: true,
  name: true,
  sku: true,
  priceAr: true,
  description: true,
  imageKey: true,
  imageAlt: true,
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

export async function setPosition(
  database: AdminProductDatabase,
  id: string,
  position: number,
): Promise<void> {
  await database.product.update({ where: { id }, data: { position }, select: { id: true } });
}

/** What an audit entry may hold: flags, prices and field names, never a name or personal data. */
type AuditValue = boolean | number | readonly string[] | Readonly<Record<string, boolean | number>>;

export interface ProductAudit {
  readonly actorId: string;
  readonly action:
    | "product.created"
    | "product.updated"
    | "product.availability_changed"
    | "product.retired"
    | "product.restored"
    | "product.photo_replaced";
  readonly productId: string;
  readonly diff: Readonly<Record<string, AuditValue>>;
}

export interface NewProduct {
  readonly name: string;
  readonly sku: string;
  readonly priceAr: number;
  readonly description: string | null;
  readonly imageAlt: string | null;
  readonly available: boolean;
  readonly active: boolean;
  readonly position: number;
  readonly availabilityChangedAt: Date;
}

export function insertProduct(
  database: AdminProductDatabase,
  product: NewProduct,
): Promise<StoredAdminProduct> {
  return database.product.create({ data: product, select: PRODUCT_SELECT });
}

/** The columns to write: Prisma ignores the keys that are undefined. */
export interface ProductWrite {
  readonly name?: string;
  readonly sku?: string;
  readonly priceAr?: number;
  readonly description?: string | null;
  readonly imageAlt?: string | null;
  readonly imageKey?: string;
  readonly available?: boolean;
  readonly active?: boolean;
  readonly position?: number;
  readonly availabilityChangedAt?: Date;
}

export function updateProduct(
  database: AdminProductDatabase,
  id: string,
  data: ProductWrite,
): Promise<StoredAdminProduct> {
  return database.product.update({ where: { id }, data, select: PRODUCT_SELECT });
}

/** How many products point at this file: a demo file can be shared. */
export function countProductsWithImageKey(
  database: AdminProductDatabase,
  imageKey: string,
): Promise<number> {
  return database.product.count({ where: { imageKey } });
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
