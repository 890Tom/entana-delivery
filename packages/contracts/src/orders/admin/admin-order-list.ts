import { z } from "zod";
import { ORDER_STATUSES } from "../tracking/tracking-response.js";
import { orderCodeSchema } from "../code/order-code.js";
import { decodeOrderCursor } from "./admin-order-cursor.js";

export const DEFAULT_ADMIN_ORDER_LIMIT = 25;
export const MAX_ADMIN_ORDER_LIMIT = 100;

const statusSchema = z.enum(ORDER_STATUSES);

/** What a row of the list and the head of the detail both show. */
export const adminOrderSummarySchema = z.strictObject({
  id: z.uuid(),
  publicCode: orderCodeSchema,
  status: statusSchema,
  createdAt: z.iso.datetime(),
  deliveryDate: z.iso.date().nullable(),
  contactName: z.string(),
  phone: z.string(),
  landmarkText: z.string(),
  totalAr: z.number().int(),
  itemCount: z.number().int().positive(),
});

export type AdminOrderSummary = z.infer<typeof adminOrderSummarySchema>;

export const adminOrderListResponseSchema = z.strictObject({
  items: z.array(adminOrderSummarySchema),
  /** The cursor of the next page, or null on the last one. */
  nextCursor: z.string().nullable(),
});

export type AdminOrderListResponse = z.infer<typeof adminOrderListResponseSchema>;

const limitSchema = z
  .string()
  .regex(/^[0-9]{1,3}$/)
  .transform(Number)
  .pipe(z.number().int().min(1).max(MAX_ADMIN_ORDER_LIMIT));

// The output is the order id the cursor stands for: a text this API did not issue is refused.
const cursorSchema = z.string().transform((cursor, context) => {
  const orderId = decodeOrderCursor(cursor);
  if (orderId === null) {
    context.issues.push({ code: "custom", message: "invalid cursor", input: cursor });
    return z.NEVER;
  }
  return orderId;
});

/** The query string of the list: nothing else is accepted. */
export const adminOrderListQuerySchema = z.strictObject({
  status: statusSchema.optional(),
  limit: limitSchema.default(DEFAULT_ADMIN_ORDER_LIMIT),
  cursor: cursorSchema.optional(),
});

export type AdminOrderListQuery = z.infer<typeof adminOrderListQuerySchema>;
