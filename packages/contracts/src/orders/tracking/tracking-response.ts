import { z } from "zod";
import { orderCodeSchema } from "../code/order-code.js";

/** The header that carries the tracking token. Never the path and never the query string. */
export const TRACKING_TOKEN_HEADER = "X-Tracking-Token";

/** The seven statuses of the data model, in the order of an order's life. */
export const ORDER_STATUSES = [
  "NEW",
  "CONFIRMED",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "REJECTED",
  "CANCELLED",
  "FAILED",
] as const;

const orderStatusSchema = z.enum(ORDER_STATUSES);

export type OrderStatus = z.infer<typeof orderStatusSchema>;

/**
 * What the customer holding the tracking token gets. Strict and minimal: no name, no phone number,
 * no coordinates, no internal identifier, no administrator and no internal note. `deliveryDate` is
 * a plain day (YYYY-MM-DD), never an instant; `rejectionReason` is set only for a refusal.
 */
export const trackingResponseSchema = z.strictObject({
  orderCode: orderCodeSchema,
  status: orderStatusSchema,
  deliveryDate: z.iso.date().nullable(),
  landmarkText: z.string(),
  totalAr: z.number().int(),
  deliveryFeeAr: z.number().int(),
  createdAt: z.iso.datetime(),
  rejectionReason: z.string().nullable(),
  canCancel: z.boolean(),
});

export type TrackingResponse = z.infer<typeof trackingResponseSchema>;
