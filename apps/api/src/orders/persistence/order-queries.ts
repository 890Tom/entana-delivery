import type { PrismaClient } from "@entana/database";
import type { StoredOrder } from "../rules/matches-stored-order.js";
import type { OrderableProduct } from "../rules/resolve-order-lines.js";

/** What the queries need from the client: the PrismaClient and its transaction client both fit. */
export type OrderReader = Pick<
  PrismaClient,
  "customerOrder" | "customer" | "product" | "$queryRaw"
>;

export interface CustomerRecord {
  readonly id: string;
  readonly isBlocked: boolean;
}

// An explicit allow-list: exactly what a replay compares and answers from.
export const STORED_ORDER_SELECT = {
  publicCode: true,
  totalAr: true,
  createdAt: true,
  publicTokenHash: true,
  contactName: true,
  customerNote: true,
  landmarkText: true,
  lat: true,
  lng: true,
  customer: { select: { phoneE164: true } },
  items: { select: { productId: true, qty: true } },
} as const;

export function findOrderByIdempotencyKey(
  database: Pick<PrismaClient, "customerOrder">,
  idempotencyKey: string,
): Promise<StoredOrder | null> {
  return database.customerOrder.findUnique({
    where: { idempotencyKey },
    select: STORED_ORDER_SELECT,
  });
}

/**
 * Creates the customer when the phone number is new and leaves an existing row untouched
 * (INSERT ... ON CONFLICT DO NOTHING): the trust level is never written here. A concurrent
 * insert of the same number waits for the other transaction, then finds its row.
 */
export async function ensureCustomer(
  database: OrderReader,
  phoneE164: string,
): Promise<CustomerRecord> {
  await database.customer.createMany({ data: [{ phoneE164 }], skipDuplicates: true });
  const customer = await database.customer.findUniqueOrThrow({
    where: { phoneE164 },
    select: { id: true, trustLevel: true },
  });
  return { id: customer.id, isBlocked: customer.trustLevel === "BLOCKED" };
}

/**
 * Raw SQL is justified here and nowhere else in the orders module: Prisma Client has no
 * `SELECT ... FOR UPDATE`. The statement is parameterised, locks only this customer's row until
 * the transaction ends and returns nothing. Without it, two concurrent requests of one phone both
 * count the same orders and both pass the per-phone limit (a test proves it).
 */
export async function lockCustomerRow(database: OrderReader, customerId: string): Promise<void> {
  await database.$queryRaw`SELECT 1 AS locked FROM customer WHERE id = ${customerId}::uuid FOR UPDATE`;
}

export function countOrdersSince(
  database: OrderReader,
  customerId: string,
  since: Date,
): Promise<number> {
  return database.customerOrder.count({ where: { customerId, createdAt: { gte: since } } });
}

/** All the requested products in ONE query. */
export function readProducts(
  database: OrderReader,
  productIds: readonly string[],
): Promise<OrderableProduct[]> {
  return database.product.findMany({
    where: { id: { in: [...productIds] } },
    select: { id: true, name: true, priceAr: true, active: true, available: true },
  });
}
