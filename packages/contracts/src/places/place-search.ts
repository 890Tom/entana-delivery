import { z } from "zod";
import { latitudeSchema, longitudeSchema } from "../instance/instance-config.js";

const PLACE_SEARCH_TEXT_MIN_LENGTH = 3;
const PLACE_SEARCH_TEXT_MAX_LENGTH = 100;
export const MAX_PLACE_SUGGESTIONS = 5;

/** Query of GET /api/v1/places/search. Strict: an unknown parameter is an error. */
export const placeSearchQuerySchema = z.strictObject({
  q: z.string().trim().min(PLACE_SEARCH_TEXT_MIN_LENGTH).max(PLACE_SEARCH_TEXT_MAX_LENGTH),
});

export type PlaceSearchQuery = z.infer<typeof placeSearchQuerySchema>;

/** A place proposed for a typed address: a text to show and a point for the map. */
export const placeSuggestionSchema = z.strictObject({
  label: z.string().min(1),
  lat: latitudeSchema,
  lng: longitudeSchema,
});

export type PlaceSuggestion = z.infer<typeof placeSuggestionSchema>;

/** Response of GET /api/v1/places/search: places of Madagascar, in the order of the provider. */
export const placeSearchResponseSchema = z.strictObject({
  suggestions: z.array(placeSuggestionSchema).max(MAX_PLACE_SUGGESTIONS),
});

export type PlaceSearchResponse = z.infer<typeof placeSearchResponseSchema>;
