import type { GeoPoint } from "../map/map-adapter";

/** The radius of the contract's distance (haversine), so that a circle drawn is the one computed. */
const EARTH_RADIUS_METERS = 6_371_000;
/** Enough sides for a circle to look round at street zoom. */
const RING_STEPS = 64;

const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;
const toDegrees = (radians: number): number => (radians * 180) / Math.PI;

/** The point at this distance and bearing from the centre, on a sphere, as [lng, lat]. */
function destination(center: GeoPoint, distanceM: number, bearing: number): [number, number] {
  const angle = distanceM / EARTH_RADIUS_METERS;
  const lat = toRadians(center.lat);
  const destinationLat = Math.asin(
    Math.sin(lat) * Math.cos(angle) + Math.cos(lat) * Math.sin(angle) * Math.cos(bearing),
  );
  const destinationLng =
    toRadians(center.lng) +
    Math.atan2(
      Math.sin(bearing) * Math.sin(angle) * Math.cos(lat),
      Math.cos(angle) - Math.sin(lat) * Math.sin(destinationLat),
    );
  return [toDegrees(destinationLng), toDegrees(destinationLat)];
}

/**
 * The outline of a circle of `radiusM` metres on the ground, as a closed ring of [lng, lat]
 * positions: the map draws it at its true size whatever the zoom (a pixel radius would not be).
 */
export function toCircleRing(center: GeoPoint, radiusM: number): [number, number][] {
  // One more position than steps: the last one is the first again (same bearing), so the ring closes.
  return Array.from({ length: RING_STEPS + 1 }, (_unused, step) =>
    destination(center, radiusM, (2 * Math.PI * (step % RING_STEPS)) / RING_STEPS),
  );
}
