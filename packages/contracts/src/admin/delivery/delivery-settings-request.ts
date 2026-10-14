import { z } from "zod";
import {
  MAX_ORDER_LINES,
  MAX_ORDER_LINE_QUANTITY,
} from "../../orders/request/create-order-request.js";
import { outOfAxisMessageSchema } from "../../delivery/delivery-settings.js";
import { PRODUCT_PRICE_MAX_AR } from "../catalogue/product-form.js";

/** The most pieces an order can hold: a threshold above it could never be reached. */
export const MAX_FREE_DELIVERY_MIN_PIECES = MAX_ORDER_LINES * MAX_ORDER_LINE_QUANTITY;

/** A partial change of the delivery settings: at least one field, the others are kept. */
export const updateDeliverySettingsRequestSchema = z
  .strictObject({
    outOfAxisFeeAr: z.number().int().min(0).max(PRODUCT_PRICE_MAX_AR).optional(),
    freeDeliveryMinPieces: z.number().int().min(1).max(MAX_FREE_DELIVERY_MIN_PIECES).optional(),
    outOfAxisMessage: outOfAxisMessageSchema.optional(),
  })
  .refine((request) => Object.keys(request).length > 0, "At least one field is required.");

export type UpdateDeliverySettingsRequest = z.infer<typeof updateDeliverySettingsRequestSchema>;
