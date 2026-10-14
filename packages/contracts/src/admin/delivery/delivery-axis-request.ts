import { z } from "zod";

/** Technical limit on the places of one axis. */
export const MAX_PLACES_PER_AXIS = 50;

export const DELIVERY_NAME_MAX_LENGTH = 60;

/** Bounds of the radius of a place (ck_place_radius_range) and its default (the column default). */
export const PLACE_RADIUS_MIN_M = 100;
export const PLACE_RADIUS_MAX_M = 3000;
export const DEFAULT_PLACE_RADIUS_M = 500;

const name = z.string().trim().min(1).max(DELIVERY_NAME_MAX_LENGTH);

const existingPlaceSchema = z.strictObject({ placeId: z.uuid() });

const newPlaceSchema = z.strictObject({
  name,
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  radiusM: z.number().int().min(PLACE_RADIUS_MIN_M).max(PLACE_RADIUS_MAX_M).optional(),
});

const placeEntrySchema = z.union([existingPlaceSchema, newPlaceSchema]);

/**
 * The body of the creation and of the replacement of an axis. The places are an ordered list: an
 * existing place by id, or a new one. The same place twice is a malformed body; a taken name is
 * not (the server answers 409), so the schema checks the shape only.
 */
export const saveDeliveryAxisRequestSchema = z.strictObject({
  name,
  active: z.boolean(),
  places: z
    .array(placeEntrySchema)
    .min(1)
    .max(MAX_PLACES_PER_AXIS)
    .refine((places) => {
      const ids = places.flatMap((place) =>
        "placeId" in place ? [place.placeId.toLowerCase()] : [],
      );
      return new Set(ids).size === ids.length;
    }, "A place can be listed once."),
});

export type SaveDeliveryAxisRequest = z.infer<typeof saveDeliveryAxisRequestSchema>;
export type DeliveryAxisPlaceEntry = SaveDeliveryAxisRequest["places"][number];

/**
 * The new order of the axes. Duplicates and a wrong set are not a malformed body: the server
 * answers them with a 422 (see `planAxisReorder`), so the schema checks the shape only.
 */
export const reorderDeliveryAxesRequestSchema = z.strictObject({ ids: z.array(z.uuid()) });

export type ReorderDeliveryAxesRequest = z.infer<typeof reorderDeliveryAxesRequestSchema>;
