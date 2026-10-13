import type { PublicReseller } from "@entana/contracts";

const DIRECTIONS_URL = "https://www.google.com/maps/dir/?api=1&destination=";

/**
 * The address of the directions page of an outside provider. It holds the two numbers of the
 * reseller and nothing else: the position of the customer is never part of it.
 */
export function buildDirectionsUrl(
  destination: Pick<PublicReseller, "latitude" | "longitude">,
): string {
  return `${DIRECTIONS_URL}${String(destination.latitude)},${String(destination.longitude)}`;
}
