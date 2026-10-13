const KILOMETRE_FORMAT = new Intl.NumberFormat("fr-FR", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

/** "0,4 km": French decimal comma, one decimal, a non-breaking space before the unit. */
export function formatDistance(distanceKm: number): string {
  return `${KILOMETRE_FORMAT.format(distanceKm)}\u00a0km`;
}
