const ARROW = " → ";
const GAP = "…";
/** Up to this number of places, the summary names them all. */
const MAX_NAMED_PLACES = 3;

/**
 * The route of an axis on one line: every place up to three, else the first two, "…" and the
 * last ("A → B → … → Z").
 */
export function summarizeRoute(placeNames: readonly string[]): string {
  if (placeNames.length <= MAX_NAMED_PLACES) {
    return placeNames.join(ARROW);
  }
  return [...placeNames.slice(0, 2), GAP, ...placeNames.slice(-1)].join(ARROW);
}
