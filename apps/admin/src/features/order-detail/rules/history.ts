import type { AdminOrderDetail, OrderStatus } from "@entana/contracts";

export type HistoryActor = AdminOrderDetail["events"][number]["actor"]["type"];

export interface HistoryEntry {
  readonly status: OrderStatus;
  readonly actor: HistoryActor;
  readonly createdAt: string;
}

/**
 * One entry per status change, oldest first. The other kinds of event (lines, fee, date) are not
 * part of this screen.
 */
export function buildHistory(events: AdminOrderDetail["events"]): readonly HistoryEntry[] {
  return events
    .flatMap((event): HistoryEntry[] =>
      event.type === "STATUS_CHANGED" && event.toStatus !== null
        ? [{ status: event.toStatus, actor: event.actor.type, createdAt: event.createdAt }]
        : [],
    )
    .sort((first, second) => first.createdAt.localeCompare(second.createdAt));
}
