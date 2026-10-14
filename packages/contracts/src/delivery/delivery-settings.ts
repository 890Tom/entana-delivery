import { z } from "zod";

/** Technical limit on the number of axes; enforced where axes are created. */
export const MAX_DELIVERY_AXES = 10;

export const OUT_OF_AXIS_MESSAGE_MAX_LENGTH = 200;

/** Plain text, 1 to 200 characters once the spaces around it are removed. */
export const outOfAxisMessageSchema = z.string().trim().min(1).max(OUT_OF_AXIS_MESSAGE_MAX_LENGTH);

export const deliverySettingsSchema = z.object({
  outOfAxisFeeAr: z.number().int().min(0),
  freeDeliveryMinPieces: z.number().int().min(1),
  outOfAxisMessage: outOfAxisMessageSchema,
});
export type DeliverySettings = z.infer<typeof deliverySettingsSchema>;
