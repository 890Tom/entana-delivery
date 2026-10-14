export interface GeoPoint {
  readonly lat: number;
  readonly lng: number;
}

const EARTH_RADIUS_METERS = 6_371_000;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/** The distance in metres between two points as the crow flies (haversine formula). */
export function computeDistanceMeters(from: GeoPoint, to: GeoPoint): number {
  const latitudeGap = toRadians(to.lat - from.lat);
  const longitudeGap = toRadians(to.lng - from.lng);
  const a =
    Math.sin(latitudeGap / 2) ** 2 +
    Math.cos(toRadians(from.lat)) * Math.cos(toRadians(to.lat)) * Math.sin(longitudeGap / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(a));
}
