import type { PrismaClient } from "@entana/database";
import type { OrderStatus } from "@entana/contracts";
import type { TrackedOrder } from "../rules/to-tracking-view.js";

/** What the queries need from the client: the PrismaClient and its transaction client both fit. */
export type TrackingReader = Pick<PrismaClient, "customerOrder" | "orderEvent" | "orderItem">;

/** The order as read for tracking: the view's columns plus the two ids the server keeps to itself. */
export interface StoredTrackedOrder extends TrackedOrder {
  readonly id: string;
  readonly customerId: string;
}

// An explicit allow-list: no name, no note, no coordinates, no driver.
const TRACKED_ORDER_SELECT = {
  id: true,
  customerId: true,
  publicCode: true,
  status: true,
  deliveryDate: true,
  landmarkText: true,
  totalAr: true,
  deliveryFee: true,
  createdAt: true,
  statusReason: true,
} as const;

type StoredOrderColumns = Omit<StoredTrackedOrder, "itemCount">;

export function findOrderByTokenHash(
  database: TrackingReader,
  publicTokenHash: string,
): Promise<StoredOrderColumns | null> {
  return database.customerOrder.findUnique({
    where: { publicTokenHash },
    select: TRACKED_ORDER_SELECT,
  });
}

/** The sum of the quantities of the order's lines, or null for an order that has none. */
export async function sumItemQuantities(
  database: TrackingReader,
  orderId: string,
): Promise<number | null> {
  const { _sum } = await database.orderItem.aggregate({
    where: { orderId },
    _sum: { qty: true },
  });
  return _sum.qty;
}

/**
 * When the order reached its current status: the last status change to it. The order itself has
 * no such column, and the event is written in the same transaction as the change.
 */
export async function findStatusReachedAt(
  database: TrackingReader,
  orderId: string,
  status: OrderStatus,
): Promise<Date | null> {
  const event = await database.orderEvent.findFirst({
    where: { orderId, type: "STATUS_CHANGED", toStatus: status },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: { createdAt: true },
  });
  return event?.createdAt ?? null;
}

/**
 * Moves the order to CANCELLED only if it still has the status that was read: a change made by the
 * shop in between matches no row. Returns whether this call made the change.
 */
export async function cancelIfStatusIs(
  database: Pick<PrismaClient, "customerOrder">,
  orderId: string,
  expected: OrderStatus,
  reason: string,
): Promise<boolean> {
  const { count } = await database.customerOrder.updateMany({
    where: { id: orderId, status: expected },
    data: { status: "CANCELLED", statusReason: reason },
  });
  return count === 1;
}

export async function insertCancellationEvent(
  database: Pick<PrismaClient, "orderEvent">,
  order: { readonly id: string; readonly customerId: string },
  fromStatus: OrderStatus,
  createdAt: Date,
): Promise<void> {
  // Mirrors the creation event: an empty payload, no customer data in an event.
  await database.orderEvent.create({
    data: {
      orderId: order.id,
      type: "STATUS_CHANGED",
      fromStatus,
      toStatus: "CANCELLED",
      actorType: "CUSTOMER",
      actorId: order.customerId,
      payload: {},
      createdAt,
    },
  });
}
