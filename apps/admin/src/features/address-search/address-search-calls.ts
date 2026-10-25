import { placeSearchResponseSchema } from "@entana/contracts";
import type { PlaceSearchResponse } from "@entana/contracts";

import { fetchAdmin } from "../../data-fetching/fetch-admin";
import type { AdminResult } from "../../data-fetching/fetch-admin";

const PLACES_SEARCH_API_PATH = "/api/v1/places/search";

/**
 * The places that match a typed text. The text goes in the parameters of the request only, never
 * in the address of the page; the server answers `no-store` and nothing is kept here.
 */
export function searchPlaces(
  text: string,
  signal: AbortSignal,
): Promise<AdminResult<PlaceSearchResponse>> {
  return fetchAdmin(
    { path: PLACES_SEARCH_API_PATH, params: new URLSearchParams({ q: text }), signal },
    placeSearchResponseSchema,
  );
}
