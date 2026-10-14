import type { AdminDeliveryAxis, GeoPoint } from "@entana/contracts";

interface DrawnPlace extends GeoPoint {
  readonly radiusM: number;
}

export interface DrawnAxis {
  readonly id: string;
  readonly color: string;
  readonly places: readonly DrawnPlace[];
}

/** A point of a shape as the map reads it: longitude first. */
type Position = [number, number];

interface ShapeFeature {
  type: "Feature";
  properties: { color: string };
  geometry:
    | { type: "LineString"; coordinates: Position[] }
    | { type: "Polygon"; coordinates: Position[][] };
}

export interface ShapeCollection {
  type: "FeatureCollection";
  features: ShapeFeature[];
}

export interface Bounds {
  readonly west: number;
  readonly south: number;
  readonly east: number;
  readonly north: number;
}

const EARTH_RADIUS_METERS = 6_371_000;
const CIRCLE_STEPS = 64;

const toDegrees = (radians: number): number => (radians * 180) / Math.PI;

/**
 * What the map draws: the active axes and their active places only. The list comes in priority
 * order; the result is reversed, so that the axis of highest priority is drawn last, on top.
 */
export function selectDrawnAxes(axes: readonly AdminDeliveryAxis[]): DrawnAxis[] {
  return axes
    .filter((axis) => axis.active)
    .map((axis) => ({
      id: axis.id,
      color: axis.color,
      places: axis.places
        .filter((place) => place.active)
        .map((place) => ({ lat: place.latitude, lng: place.longitude, radiusM: place.radiusM })),
    }))
    .reverse();
}

/**
 * The closed ring of a circle of `radiusM` metres around a point. A flat approximation: the
 * radii of the places are 3 km at most, where its error is far below a pixel.
 */
export function circleRing(center: GeoPoint, radiusM: number, steps = CIRCLE_STEPS): Position[] {
  const angularRadius = radiusM / EARTH_RADIUS_METERS;
  const latitudeScale = Math.cos((center.lat * Math.PI) / 180);
  const ring = Array.from({ length: steps }, (_, index): Position => {
    const angle = (2 * Math.PI * index) / steps;
    return [
      center.lng + toDegrees((angularRadius * Math.cos(angle)) / latitudeScale),
      center.lat + toDegrees(angularRadius * Math.sin(angle)),
    ];
  });
  return [...ring, ...ring.slice(0, 1)];
}

function featuresOf(axis: DrawnAxis, color: string): ShapeFeature[] {
  const zones = axis.places.map((place): ShapeFeature => ({
    type: "Feature",
    properties: { color },
    geometry: { type: "Polygon", coordinates: [circleRing(place, place.radiusM)] },
  }));
  if (axis.places.length < 2) {
    return zones;
  }
  const route: ShapeFeature = {
    type: "Feature",
    properties: { color },
    geometry: {
      type: "LineString",
      coordinates: axis.places.map((place) => [place.lng, place.lat]),
    },
  };
  return [...zones, route];
}

/** The circles of the places and the line that joins their centres, in the colour of each axis. */
export function toShapes(axes: readonly DrawnAxis[]): ShapeCollection {
  return {
    type: "FeatureCollection",
    features: axes.flatMap((axis) => featuresOf(axis, axis.color)),
  };
}

/** The box around the centres of every drawn place; null when there is none. */
export function boundsOf(axes: readonly DrawnAxis[]): Bounds | null {
  const places = axes.flatMap((axis) => axis.places);
  if (places.length === 0) {
    return null;
  }
  const lats = places.map((place) => place.lat);
  const lngs = places.map((place) => place.lng);
  return {
    west: Math.min(...lngs),
    south: Math.min(...lats),
    east: Math.max(...lngs),
    north: Math.max(...lats),
  };
}
