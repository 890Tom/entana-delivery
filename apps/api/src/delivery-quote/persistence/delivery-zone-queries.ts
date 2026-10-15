import type { PrismaClient } from "@entana/database";
import type { DeliveryZoneRow } from "../mapping/to-delivery-zone.js";

/** What the query needs: the PrismaClient fits. */
export type DeliveryZoneReader = Pick<PrismaClient, "place">;

/**
 * The places a quote may match: active, in at least one active axis (as `listActiveAxes` reads
 * them). One row per place, so a place of several axes comes once. By name, then id.
 */
export function listCoveredPlaces(database: DeliveryZoneReader): Promise<DeliveryZoneRow[]> {
  return database.place.findMany({
    where: { active: true, axes: { some: { axis: { active: true } } } },
    select: { id: true, name: true, lat: true, lng: true, radiusM: true },
    orderBy: [{ name: "asc" }, { id: "asc" }],
  });
}
