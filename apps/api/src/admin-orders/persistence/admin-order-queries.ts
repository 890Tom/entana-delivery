import type { OrderStatus } from "@entana/contracts";
import type { PrismaClient } from "@entana/database";
import type { StoredAdminOrder, StoredOrderSummary } from "../rules/to-admin-order.js";

/** What the queries need from the client: the PrismaClient and its transaction client both fit. */
export type AdminOrderDatabase = Pick<PrismaClient, "customerOrder" | "orderEvent">;

// An explicit allow-list: the token hash, the customer's id and the driver never leave the database.
const SUMMARY_SELECT = {
  id: true,
  publicCode: true,
  status: true,
  createdAt: true,
  deliveryDate: true,
  contactName: true,
  landmarkText: true,
  totalAr: true,
  customer: { select: { phoneE164: true } },
  items: { select: { qty: true } },
} as const;

/**
 * One page, newest first: `limit + 1` rows are read so that the caller knows whether another page
 * follows. The id is a uuidv7, so ordering by it is ordering by creation, and "older than the
 * cursor" is a range on the primary key (no OFFSET).
 */
export function findOrderPage(
  database: AdminOrderDatabase,
  filter: { status?: OrderStatus; before?: string; limit: number },
): Promise<StoredOrderSummary[]> {
  return database.customerOrder.findMany({
    where: {
      ...(filter.status === undefined ? {} : { status: filter.status }),
      ...(filter.before === undefined ? {} : { id: { lt: filter.before } }),
    },
    orderBy: { id: "desc" },
    take: filter.limit + 1,
    select: SUMMARY_SELECT,
  });
}

const DETAIL_SELECT = {
  ...SUMMARY_SELECT,
  deliveryFee: true,
  customerNote: true,
  lat: true,
  lng: true,
  statusReason: true,
  items: {
    select: { productName: true, unitPrice: true, qty: true },
    orderBy: { id: "asc" },
  },
  events: {
    select: {
      type: true,
      fromStatus: true,
      toStatus: true,
      createdAt: true,
      actorType: true,
      actorId: true,
    },
    // uuidv7: by id is by creation, and it breaks the tie of two events in the same millisecond.
    orderBy: { id: "asc" },
  },
} as const;

export function findOrderDetail(
  database: AdminOrderDatabase,
  id: string,
): Promise<StoredAdminOrder | null> {
  return database.customerOrder.findUnique({ where: { id }, select: DETAIL_SELECT });
}

/** For an order that was just written in the same transaction: it exists, or the fault is ours. */
export function requireOrderDetail(
  database: AdminOrderDatabase,
  id: string,
): Promise<StoredAdminOrder> {
  return database.customerOrder.findUniqueOrThrow({ where: { id }, select: DETAIL_SELECT });
}

export async function findOrderStatus(
  database: AdminOrderDatabase,
  id: string,
): Promise<OrderStatus | null> {
  const order = await database.customerOrder.findUnique({
    where: { id },
    select: { status: true },
  });
  return order?.status ?? null;
}

export interface StatusChange {
  readonly from: OrderStatus;
  readonly to: OrderStatus;
  readonly statusReason?: string;
  readonly deliveryDate?: Date;
}

/**
 * Moves the order only if it still has the status that was read: a change made in between (the
 * customer's cancellation included) matches no row. Returns whether this call made the change.
 */
export async function changeStatusIfStatusIs(
  database: AdminOrderDatabase,
  id: string,
  change: StatusChange,
): Promise<boolean> {
  const { count } = await database.customerOrder.updateMany({
    where: { id, status: change.from },
    data: {
      status: change.to,
      ...(change.statusReason === undefined ? {} : { statusReason: change.statusReason }),
      ...(change.deliveryDate === undefined ? {} : { deliveryDate: change.deliveryDate }),
    },
  });
  return count === 1;
}

export async function insertStatusChangedEvent(
  database: AdminOrderDatabase,
  event: {
    readonly orderId: string;
    readonly change: StatusChange;
    readonly adminId: string;
    readonly payload: Readonly<Record<string, string>>;
    readonly createdAt: Date;
  },
): Promise<void> {
  await database.orderEvent.create({
    data: {
      orderId: event.orderId,
      type: "STATUS_CHANGED",
      fromStatus: event.change.from,
      toStatus: event.change.to,
      actorType: "STAFF",
      actorId: event.adminId,
      payload: { ...event.payload },
      createdAt: event.createdAt,
    },
  });
}
