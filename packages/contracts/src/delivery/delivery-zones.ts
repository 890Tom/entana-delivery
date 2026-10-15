import { z } from "zod";

/** A covered place as a visitor sees it: a circle on the map. Nothing of its axes is in it. */
export const deliveryZoneSchema = z.strictObject({
  id: z.uuid(),
  name: z.string(),
  latitude: z.number(),
  longitude: z.number(),
  radiusM: z.number().int(),
});

export type DeliveryZone = z.infer<typeof deliveryZoneSchema>;

/**
 * Response of GET /api/v1/delivery/zones: the active places of at least one active axis, once
 * each, by name. An empty list is valid. Not paginated: a shop-sized list.
 */
export const deliveryZoneListResponseSchema = z.strictObject({
  zones: z.array(deliveryZoneSchema),
});

export type DeliveryZoneListResponse = z.infer<typeof deliveryZoneListResponseSchema>;
