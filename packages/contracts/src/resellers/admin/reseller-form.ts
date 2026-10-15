import { z } from "zod";

export const RESELLER_NAME_MAX_LENGTH = 60;
export const RESELLER_NEIGHBORHOOD_MAX_LENGTH = 40;
export const RESELLER_LANDMARK_MAX_LENGTH = 120;

const fields = {
  name: z.string().trim().min(1).max(RESELLER_NAME_MAX_LENGTH),
  neighborhood: z.string().trim().min(1).max(RESELLER_NEIGHBORHOOD_MAX_LENGTH),
  // Required and never empty: the column is NOT NULL.
  landmark: z.string().trim().min(1).max(RESELLER_LANDMARK_MAX_LENGTH),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  consentGiven: z.boolean(),
  visible: z.boolean(),
};

/**
 * A new reseller. The position is required and can never be cleared. Showing it on the map
 * (`visible`) needs the consent: the service answers 422, which is not a malformed body.
 */
export const createResellerRequestSchema = z.strictObject({
  name: fields.name,
  neighborhood: fields.neighborhood,
  landmark: fields.landmark,
  latitude: fields.latitude,
  longitude: fields.longitude,
  consentGiven: fields.consentGiven.default(false),
  visible: fields.visible.default(false),
});

export type CreateResellerRequest = z.infer<typeof createResellerRequestSchema>;

/** A partial change: at least one field, and the two coordinates always together. */
export const updateResellerRequestSchema = z
  .strictObject({
    name: fields.name.optional(),
    neighborhood: fields.neighborhood.optional(),
    landmark: fields.landmark.optional(),
    latitude: fields.latitude.optional(),
    longitude: fields.longitude.optional(),
    consentGiven: fields.consentGiven.optional(),
    visible: fields.visible.optional(),
  })
  .refine((request) => Object.keys(request).length > 0, "At least one field is required.")
  .refine(
    (request) => (request.latitude === undefined) === (request.longitude === undefined),
    "The latitude and the longitude are sent together.",
  );

export type UpdateResellerRequest = z.infer<typeof updateResellerRequestSchema>;
