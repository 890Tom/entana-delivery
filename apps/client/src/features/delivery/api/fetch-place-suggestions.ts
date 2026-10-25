import { placeSearchResponseSchema } from "@entana/contracts";
import type { PlaceSearchResponse } from "@entana/contracts";

import { fetchValidated } from "../../../data-fetching/fetch-validated";
import type { RequestErrorKind } from "../../../data-fetching/fetch-validated";

/** Carries only a kind: no response text, no status, no URL, never the searched text. */
class PlaceSearchError extends Error {
  readonly kind: RequestErrorKind;

  constructor(kind: RequestErrorKind) {
    super(`Place search request failed: ${kind}`);
    this.name = "PlaceSearchError";
    this.kind = kind;
  }
}

/**
 * GET the places that match a typed text. The text goes into the address of the request (the
 * route is a GET), never into the address of the page; the server answers `no-store`.
 */
export function fetchPlaceSuggestions(
  text: string,
  signal: AbortSignal,
): Promise<PlaceSearchResponse> {
  return fetchValidated({
    url: `/api/v1/places/search?${new URLSearchParams({ q: text }).toString()}`,
    schema: placeSearchResponseSchema,
    signal,
    createError: (kind) => new PlaceSearchError(kind),
  });
}
