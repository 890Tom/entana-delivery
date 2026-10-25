import { MAX_PLACE_SUGGESTIONS } from "@entana/contracts";
import type { PlaceSuggestion } from "@entana/contracts";

const MADAGASCAR_COUNTRY_CODE = "MG";

/** A place read from the provider, before the selection. */
export interface PlaceCandidate extends PlaceSuggestion {
  readonly countryCode: string | undefined;
}

/** The places of Madagascar, in the order of the provider, at most MAX_PLACE_SUGGESTIONS. */
export function selectSuggestions(candidates: readonly PlaceCandidate[]): PlaceSuggestion[] {
  return candidates
    .filter((candidate) => candidate.countryCode === MADAGASCAR_COUNTRY_CODE)
    .slice(0, MAX_PLACE_SUGGESTIONS)
    .map(({ label, lat, lng }) => ({ label, lat, lng }));
}
