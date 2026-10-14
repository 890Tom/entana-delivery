import { computeDistanceMeters } from "./haversine-distance.js";
import type { GeoPoint } from "./haversine-distance.js";

export interface DeliveryPlace extends GeoPoint {
  readonly id: string;
  readonly radiusM: number;
  readonly active: boolean;
}

export interface DeliveryAxis {
  readonly id: string;
  /** Priority: 1 is the highest. */
  readonly rank: number;
  readonly active: boolean;
  readonly places: readonly DeliveryPlace[];
}

export interface DeliveryMatch {
  readonly axis: DeliveryAxis;
  readonly place: DeliveryPlace;
}

interface CoveringPlace {
  readonly place: DeliveryPlace;
  readonly distanceM: number;
}

function compareIds(left: string, right: string): number {
  if (left < right) return -1;
  return left > right ? 1 : 0;
}

function findCoveringPlaces(point: GeoPoint, axis: DeliveryAxis): CoveringPlace[] {
  return axis.places
    .filter((place) => place.active)
    .map((place) => ({ place, distanceM: computeDistanceMeters(point, place) }))
    .filter(({ place, distanceM }) => distanceM <= place.radiusM);
}

function pickClosest(covering: readonly CoveringPlace[]): DeliveryPlace | undefined {
  const sorted = [...covering].sort(
    (left, right) => left.distanceM - right.distanceM || compareIds(left.place.id, right.place.id),
  );
  return sorted[0]?.place;
}

/**
 * The axis that serves a point, with the place that covers it: the active axis of the lowest rank
 * that has an active place around the point, and in it the place whose centre is the closest.
 * A point exactly at the radius is covered. Null when no axis serves the point.
 */
export function resolveDeliveryAxis(
  point: GeoPoint,
  axes: readonly DeliveryAxis[],
): DeliveryMatch | null {
  const byRank = axes.filter((axis) => axis.active).sort((left, right) => left.rank - right.rank);
  for (const axis of byRank) {
    const place = pickClosest(findCoveringPlaces(point, axis));
    if (place !== undefined) return { axis, place };
  }
  return null;
}
