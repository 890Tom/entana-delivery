import type { DeliveryZone } from "@entana/contracts";
import type { Place } from "@entana/database";

/** The columns the public zones read: the active flag and the axes are not among them. */
export type DeliveryZoneRow = Pick<Place, "id" | "name" | "lat" | "lng" | "radiusM">;

/** The names of the contract on the columns: latitude is `lat`, longitude is `lng`. */
export function toDeliveryZone(row: DeliveryZoneRow): DeliveryZone {
  return {
    id: row.id,
    name: row.name,
    latitude: row.lat,
    longitude: row.lng,
    radiusM: row.radiusM,
  };
}
