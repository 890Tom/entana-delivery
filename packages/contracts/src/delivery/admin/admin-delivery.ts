import { z } from "zod";
import { deliveryAxisColorSchema } from "./delivery-axis-request.js";

const placeBase = {
  id: z.uuid(),
  name: z.string(),
  latitude: z.number(),
  longitude: z.number(),
  radiusM: z.number().int(),
};

/** A place inside an axis: inactive places stay visible there, and `alsoIn` lists the other axes. */
export const adminDeliveryAxisPlaceSchema = z.strictObject({
  ...placeBase,
  active: z.boolean(),
  alsoIn: z.array(z.strictObject({ id: z.uuid(), name: z.string() })),
});

export const adminDeliveryAxisSchema = z.strictObject({
  id: z.uuid(),
  name: z.string(),
  rank: z.number().int(),
  color: deliveryAxisColorSchema,
  active: z.boolean(),
  places: z.array(adminDeliveryAxisPlaceSchema),
});

/** Every axis, active or not, by rank. */
export const adminDeliveryAxisListResponseSchema = z.strictObject({
  axes: z.array(adminDeliveryAxisSchema),
});

export const adminDeliveryPlaceSchema = z.strictObject(placeBase);

/** The active places, by name. Not paginated: a shop-sized list. */
export const adminDeliveryPlaceListResponseSchema = z.strictObject({
  places: z.array(adminDeliveryPlaceSchema),
});

export type AdminDeliveryAxisPlace = z.infer<typeof adminDeliveryAxisPlaceSchema>;
export type AdminDeliveryAxis = z.infer<typeof adminDeliveryAxisSchema>;
export type AdminDeliveryAxisListResponse = z.infer<typeof adminDeliveryAxisListResponseSchema>;
export type AdminDeliveryPlace = z.infer<typeof adminDeliveryPlaceSchema>;
export type AdminDeliveryPlaceListResponse = z.infer<typeof adminDeliveryPlaceListResponseSchema>;
