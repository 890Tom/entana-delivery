import type { PublicReseller } from "@entana/contracts";

import type { GeoPoint } from "../../delivery/map/map-adapter";

import { computeDistanceKm } from "./haversine-distance";

/** A reseller and its distance to the customer; null while the position is not known. */
export interface ShopEntry {
  readonly reseller: PublicReseller;
  readonly distanceKm: number | null;
}

/**
 * The order of the API without a position; from the nearest to the farthest with one. The sort is
 * stable: two equal distances keep the order of the API.
 */
export function toShopEntries(
  resellers: readonly PublicReseller[],
  origin: GeoPoint | null,
): readonly ShopEntry[] {
  if (origin === null) {
    return resellers.map((reseller) => ({ reseller, distanceKm: null }));
  }
  return resellers
    .map((reseller) => ({
      reseller,
      distanceKm: computeDistanceKm(origin, { lat: reseller.latitude, lng: reseller.longitude }),
    }))
    .sort((first, second) => first.distanceKm - second.distanceKm);
}
