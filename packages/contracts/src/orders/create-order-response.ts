import { z } from "zod";
import { orderCodeSchema } from "./order-code.js";

/**
 * What the customer gets back after an order creation. Strict and minimal: no tracking token (the
 * client already holds it), no phone number, no coordinates and no customer data. The status is
 * always NEW because the response describes the creation, even for a replay of an order that has
 * moved on since.
 */
export const createOrderResponseSchema = z.strictObject({
  orderCode: orderCodeSchema,
  status: z.literal("NEW"),
  totalAr: z.number().int(),
  createdAt: z.iso.datetime(),
});

export type CreateOrderResponse = z.infer<typeof createOrderResponseSchema>;
