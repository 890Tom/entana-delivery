import { computeOrderTotal } from "../total/compute-order-total.js";
import type { OrderLineAmount } from "../total/compute-order-total.js";
import { doesAmountFitColumn } from "../total/order-amount-limit.js";

/** What the order holds when it is confirmed: its frozen lines and its recorded fee. */
export interface FrozenOrderAmounts {
  readonly deliveryFeeAr: number;
  readonly lines: readonly OrderLineAmount[];
}

export type DeliveryFeeAdjustmentPlan =
  | { readonly kind: "unchanged" }
  | {
      readonly kind: "adjusted";
      readonly fromAr: number;
      readonly toAr: number;
      /** The frozen lines plus the new fee. */
      readonly totalAr: number;
    }
  /** The new total would not fit the integer columns of the order: nothing may change. */
  | { readonly kind: "too-large" };

/**
 * What a fee given at confirmation does to the order: nothing when it is absent or equal to the
 * recorded one, otherwise a new fee and a total computed again from the frozen lines.
 */
export function planDeliveryFeeAdjustment(
  order: FrozenOrderAmounts,
  requestedFeeAr: number | undefined,
): DeliveryFeeAdjustmentPlan {
  if (requestedFeeAr === undefined || requestedFeeAr === order.deliveryFeeAr) {
    return { kind: "unchanged" };
  }
  const totalAr = computeOrderTotal(order.lines, requestedFeeAr);
  if (!doesAmountFitColumn(totalAr)) {
    return { kind: "too-large" };
  }
  return { kind: "adjusted", fromAr: order.deliveryFeeAr, toAr: requestedFeeAr, totalAr };
}
