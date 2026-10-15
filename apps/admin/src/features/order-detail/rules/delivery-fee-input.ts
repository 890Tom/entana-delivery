import { statusTransitionRequestSchema } from "@entana/contracts";
import type { StatusTransitionRequest } from "@entana/contracts";

/** What the fee field says about the confirmation: keep the fee, change it, or nothing valid. */
export type FeeChoice =
  | { readonly kind: "unchanged" }
  | { readonly kind: "adjusted"; readonly feeAr: number }
  | { readonly kind: "invalid" };

// The confirmation is the first member of the shared union: its fee field holds the bounds.
const confirmedFeeSchema = statusTransitionRequestSchema.options[0].shape.deliveryFeeAr;

/** Reads the digits of the field against the fee of the order; an empty field is no amount. */
export function readFeeChoice(currentFeeAr: number, digits: string): FeeChoice {
  const feeAr = digits === "" ? Number.NaN : Number(digits);
  if (!confirmedFeeSchema.safeParse(feeAr).success) {
    return { kind: "invalid" };
  }
  return feeAr === currentFeeAr ? { kind: "unchanged" } : { kind: "adjusted", feeAr };
}

/** The confirmation sends a fee only when it changed: the server then keeps the frozen one. */
export function confirmRequestOf(
  deliveryDate: string,
  choice: Exclude<FeeChoice, { kind: "invalid" }>,
): StatusTransitionRequest {
  return choice.kind === "adjusted"
    ? { to: "CONFIRMED", deliveryDate, deliveryFeeAr: choice.feeAr }
    : { to: "CONFIRMED", deliveryDate };
}
