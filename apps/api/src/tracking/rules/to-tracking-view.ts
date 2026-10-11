import { isCancellableStatus } from "@entana/contracts";
import type { OrderStatus, TrackingResponse } from "@entana/contracts";

/**
 * Written once as the reason of a cancellation made by the customer: the column is required for a
 * CANCELLED order (ck_customer_order_reason_when_closed_unhappily). It is never shown as a refusal.
 */
export const CUSTOMER_CANCELLATION_REASON = "Annulée par le client.";

/** The columns the tracking view is made from (an explicit allow-list, see the query). */
export interface TrackedOrder {
  readonly publicCode: string;
  readonly status: OrderStatus;
  readonly deliveryDate: Date | null;
  readonly landmarkText: string;
  readonly totalAr: number;
  readonly deliveryFee: number;
  readonly createdAt: Date;
  readonly statusReason: string | null;
}

// A `date` column is read as midnight UTC: its first ten characters are the calendar day as
// stored, with no time zone conversion that could move it.
function toDay(date: Date | null): string | null {
  return date === null ? null : date.toISOString().slice(0, 10);
}

export function toTrackingView(order: TrackedOrder): TrackingResponse {
  return {
    orderCode: order.publicCode,
    status: order.status,
    deliveryDate: toDay(order.deliveryDate),
    landmarkText: order.landmarkText,
    totalAr: order.totalAr,
    deliveryFeeAr: order.deliveryFee,
    createdAt: order.createdAt.toISOString(),
    // The column also holds a cancellation or a failure reason: only a refusal is a refusal.
    rejectionReason: order.status === "REJECTED" ? order.statusReason : null,
    canCancel: isCancellableStatus(order.status),
  };
}
