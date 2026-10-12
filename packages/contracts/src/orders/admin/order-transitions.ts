import type { OrderStatus } from "../tracking/tracking-response.js";

// The only moves the shop can make, one step at a time. Statuses that are not keys of a move are
// final for the shop. A confirmed order is cancelled, never refused: a refusal answers a request.
const ALLOWED_TRANSITIONS: Readonly<Record<OrderStatus, readonly OrderStatus[]>> = {
  NEW: ["CONFIRMED", "REJECTED"],
  CONFIRMED: ["OUT_FOR_DELIVERY", "CANCELLED"],
  OUT_FOR_DELIVERY: ["DELIVERED", "FAILED"],
  DELIVERED: [],
  REJECTED: [],
  CANCELLED: [],
  FAILED: [],
};

/** Whether the shop may move an order from `from` to `to`. The one table of the moves. */
export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}
