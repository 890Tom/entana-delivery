import type { DeliveryFeeReason } from "@entana/contracts";

/** The values of the `fee_reason` column that a creation writes; ADJUSTED is the admin's. */
export type CreationFeeReason = "IN_AXIS" | "OUT_OF_AXIS" | "QUANTITY";

// A Record: a new reason of the rule fails the typecheck until it has a stored value.
const STORED_REASONS: Readonly<Record<DeliveryFeeReason, CreationFeeReason>> = {
  axis: "IN_AXIS",
  out_of_axis: "OUT_OF_AXIS",
  quantity: "QUANTITY",
};

/** The reason of the pure rule, as the order stores it. */
export function toFeeReason(reason: DeliveryFeeReason): CreationFeeReason {
  return STORED_REASONS[reason];
}
