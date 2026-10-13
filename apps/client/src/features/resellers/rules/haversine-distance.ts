import type { GeoPoint } from "../../delivery/map/map-adapter";

const EARTH_RADIUS_KM = 6371;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/** The distance in kilometres as the crow flies (haversine formula), not by road. */
export function computeDistanceKm(from: GeoPoint, to: GeoPoint): number {
  const latitudeGap = toRadians(to.lat - from.lat);
  const longitudeGap = toRadians(to.lng - from.lng);
  const a =
    Math.sin(latitudeGap / 2) ** 2 +
    Math.cos(toRadians(from.lat)) * Math.cos(toRadians(to.lat)) * Math.sin(longitudeGap / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(a));
}
