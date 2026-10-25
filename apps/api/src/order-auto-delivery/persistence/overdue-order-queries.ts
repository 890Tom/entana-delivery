import type { OrderStatus, PrismaClient } from "@entana/database";

/** What the queries need: the PrismaClient fits, and so does a transaction client. */
export type OverdueOrderDatabase = Pick<PrismaClient, "customerOrder" | "orderEvent">;

export interface OverdueMove {
  readonly from: OrderStatus;
  readonly to: OrderStatus;
  /** Midnight UTC of today in the shop's time zone: only earlier delivery days are overdue. */
  readonly before: Date;
}

/**
 * Moves every overdue order still in `from` in one statement, without reading it first, and
 * returns the ids that moved. Like the admin's move, it writes the status only.
 */
export async function moveOverdueOrders(
  database: OverdueOrderDatabase,
  move: OverdueMove,
): Promise<readonly string[]> {
  const moved = await database.customerOrder.updateManyAndReturn({
    where: { status: move.from, deliveryDate: { lt: move.before } },
    data: { status: move.to },
    select: { id: true },
  });
  return moved.map((order) => order.id);
}

/** One STATUS_CHANGED event per moved order, by the system: no actor id. */
export async function insertSystemStatusEvents(
  database: OverdueOrderDatabase,
  events: {
    readonly orderIds: readonly string[];
    readonly from: OrderStatus;
    readonly to: OrderStatus;
    readonly createdAt: Date;
  },
): Promise<void> {
  await database.orderEvent.createMany({
    data: events.orderIds.map((orderId) => ({
      orderId,
      type: "STATUS_CHANGED" as const,
      fromStatus: events.from,
      toStatus: events.to,
      actorType: "SYSTEM" as const,
      actorId: null,
      payload: {},
      createdAt: events.createdAt,
    })),
  });
}
