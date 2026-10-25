import type { PlaceSuggestion } from "@entana/contracts";

/** A fake place, numbered so that each suggestion of a list differs. */
export function buildPlaceSuggestion(
  index: number,
  overrides: Partial<PlaceSuggestion> = {},
): PlaceSuggestion {
  return {
    label: `Lieu Démo ${String(index)}, Ville Démo`,
    lat: -18.9 - index / 1000,
    lng: 47.5 + index / 1000,
    ...overrides,
  };
}
