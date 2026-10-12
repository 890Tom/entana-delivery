import { z } from "zod";

/** Longest reason the shop can give for a refusal. */
export const MAX_STATUS_REASON_LENGTH = 300;

/**
 * Stored when the shop refuses an order without a reason: the column is required for a REJECTED
 * order (ck_customer_order_reason_when_closed_unhappily), and the customer sees it as the reason.
 */
export const DEFAULT_REJECTION_REASON = "Aucun motif précisé.";

/** Stored when the shop cancels a confirmed order without giving a reason (the column is required). */
export const SHOP_CANCELLATION_REASON = "Annulée par la boutique.";

/** Stored when a delivery fails: the shop gives no reason for it, the column is required. */
export const DELIVERY_FAILED_REASON = "Livraison non aboutie.";

const reasonSchema = z.string().trim().min(1).max(MAX_STATUS_REASON_LENGTH);

/**
 * The body of a status change, a union on `to`. Each member is strict: a field that the requested
 * move does not take is refused. That `deliveryDate` is neither in the past nor too far ahead
 * depends on today's date in the shop's time zone, so the server checks it
 * (see `isDeliveryDateInWindow`).
 */
export const statusTransitionRequestSchema = z.discriminatedUnion("to", [
  z.strictObject({ to: z.literal("CONFIRMED"), deliveryDate: z.iso.date() }),
  z.strictObject({ to: z.literal("REJECTED"), reason: reasonSchema.optional() }),
  z.strictObject({ to: z.literal("CANCELLED"), reason: reasonSchema.optional() }),
  z.strictObject({ to: z.literal("OUT_FOR_DELIVERY") }),
  z.strictObject({ to: z.literal("DELIVERED") }),
  z.strictObject({ to: z.literal("FAILED") }),
]);

export type StatusTransitionRequest = z.infer<typeof statusTransitionRequestSchema>;
