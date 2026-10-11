import type { OrderStatus } from "./tracking-response.js";

/**
 * How long the tracking of a finished order stays readable. To be confirmed with the shop: it is
 * a product choice, not a technical limit.
 */
export const TRACKING_RETENTION_DAYS = 30;

const DAY_MS = 86_400_000;

const CANCELLABLE_STATUSES: readonly OrderStatus[] = ["NEW", "CONFIRMED"];

// FAILED is final until the shop can reschedule a failed delivery (task 6c): the expiry will then
// have to leave it out.
const FINAL_STATUSES: readonly OrderStatus[] = ["DELIVERED", "REJECTED", "CANCELLED", "FAILED"];

/** The customer may cancel until the order is out for delivery. */
export function isCancellableStatus(status: OrderStatus): boolean {
  return CANCELLABLE_STATUSES.includes(status);
}

export function isFinalStatus(status: OrderStatus): boolean {
  return FINAL_STATUSES.includes(status);
}

/**
 * A finished order whose last status change is older than the retention is answered like an
 * unknown token. An order that is not final never expires.
 */
export function isTrackingExpired(status: OrderStatus, finalAt: Date, now: Date): boolean {
  return (
    isFinalStatus(status) && now.getTime() - finalAt.getTime() > TRACKING_RETENTION_DAYS * DAY_MS
  );
}
