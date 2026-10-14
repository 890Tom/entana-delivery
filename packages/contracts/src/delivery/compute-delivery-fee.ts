import type { DeliveryMatch } from "./resolve-delivery-axis.js";

export type DeliveryFeeReason = "axis" | "quantity" | "out_of_axis";

export interface DeliveryFeeInput {
  readonly match: DeliveryMatch | null;
  readonly totalPieces: number;
  readonly outOfAxisFeeAr: number;
  readonly freeDeliveryMinPieces: number;
}

export interface DeliveryFee {
  readonly feeAr: number;
  readonly reason: DeliveryFeeReason;
}

/**
 * Delivery is free inside an axis, and everywhere from the piece threshold; elsewhere the flat
 * out-of-axis fee applies. The axis wins when both reasons hold.
 */
export function computeDeliveryFee(input: DeliveryFeeInput): DeliveryFee {
  if (input.match !== null) return { feeAr: 0, reason: "axis" };
  if (input.totalPieces >= input.freeDeliveryMinPieces) return { feeAr: 0, reason: "quantity" };
  return { feeAr: input.outOfAxisFeeAr, reason: "out_of_axis" };
}
