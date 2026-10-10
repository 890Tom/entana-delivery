import { publicInstanceSchema } from "@entana/contracts";

import type { GeoPoint } from "../map/map-adapter";

// The bounds of a point are the contract's own (the map centre of the instance configuration).
const POINT_SCHEMA = publicInstanceSchema.shape.map.shape.center;
const DECIMAL_FACTOR = 1_000_000;

// "+ 0" turns a negative zero into zero, so that two equal points are equal.
function roundTo6Decimals(value: number): number {
  return Math.round(value * DECIMAL_FACTOR) / DECIMAL_FACTOR + 0;
}

/** A point within the bounds of the contract, rounded to 6 decimals; null when it is outside. */
export function toDeliveryPoint(lat: number, lng: number): GeoPoint | null {
  const result = POINT_SCHEMA.safeParse({ lat, lng });
  if (!result.success) {
    return null;
  }
  return { lat: roundTo6Decimals(result.data.lat), lng: roundTo6Decimals(result.data.lng) };
}
