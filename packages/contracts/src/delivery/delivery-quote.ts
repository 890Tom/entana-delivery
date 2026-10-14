import { z } from "zod";
import {
  MAX_ORDER_LINE_QUANTITY,
  MAX_ORDER_LINES,
} from "../orders/request/create-order-request.js";

/** The most pieces an order can hold: every line at its largest quantity. */
const MAX_ORDER_PIECES = MAX_ORDER_LINES * MAX_ORDER_LINE_QUANTITY;

/**
 * The body of a public delivery quote: the point of the address and the pieces of the cart.
 * The coordinates are personal data: never log a parsed request.
 */
export const deliveryQuoteRequestSchema = z.strictObject({
  // z.number() rejects NaN and the infinities; the bounds are inclusive.
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  pieces: z.number().int().min(1).max(MAX_ORDER_PIECES),
});

export type DeliveryQuoteRequest = z.infer<typeof deliveryQuoteRequestSchema>;

/**
 * The fee the server would apply now. `placeName` is set inside an axis, `outOfAxisMessage` only
 * when the out-of-axis fee applies. No id: the customer does not need them.
 */
export const deliveryQuoteResponseSchema = z.strictObject({
  feeAr: z.number().int().nonnegative(),
  reason: z.enum(["axis", "quantity", "out_of_axis"]),
  placeName: z.string().nullable(),
  outOfAxisMessage: z.string().nullable(),
  freeDeliveryMinPieces: z.number().int().min(1),
});

export type DeliveryQuoteResponse = z.infer<typeof deliveryQuoteResponseSchema>;
