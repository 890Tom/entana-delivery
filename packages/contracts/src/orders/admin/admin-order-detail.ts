import { z } from "zod";
import { ORDER_STATUSES } from "../tracking/tracking-response.js";
import { adminOrderSummarySchema } from "./admin-order-list.js";

const statusSchema = z.enum(ORDER_STATUSES);

const orderLineSchema = z.strictObject({
  /** The name as it was when the order was placed. */
  productName: z.string(),
  unitPriceAr: z.number().int(),
  quantity: z.number().int().positive(),
});

const orderEventSchema = z.strictObject({
  type: z.enum(["STATUS_CHANGED", "LINES_EDITED", "FEE_ADJUSTED", "DATE_CHANGED"]),
  fromStatus: statusSchema.nullable(),
  toStatus: statusSchema.nullable(),
  createdAt: z.iso.datetime(),
  actor: z.strictObject({
    type: z.enum(["STAFF", "CUSTOMER", "SYSTEM"]),
    id: z.uuid().nullable(),
  }),
});

/**
 * An order for the administration. Strict: the hash of the tracking token, the internal ids of
 * the customer, the place and the axis, and the payload of the events are not part of it (the
 * place and the axis are given by their names, in `deliveryZone`).
 */
export const adminOrderDetailSchema = adminOrderSummarySchema.extend({
  lines: z.array(orderLineSchema),
  deliveryFeeAr: z.number().int(),
  customerNote: z.string().nullable(),
  latitude: z.number(),
  longitude: z.number(),
  /** Set only for a refusal: the same column also holds a cancellation or a failure reason. */
  rejectionReason: z.string().nullable(),
  events: z.array(orderEventSchema),
});

export type AdminOrderDetail = z.infer<typeof adminOrderDetailSchema>;
