import type { PublicReseller } from "@entana/contracts";
import type { Reseller } from "@entana/database";

/** The columns the public list reads: consent, visibility and verification are not among them. */
export type PublicResellerRow = Pick<
  Reseller,
  "id" | "name" | "area" | "landmarkText" | "lat" | "lng"
>;

/** The names of the contract on the columns: neighborhood is `area`, landmark is `landmarkText`. */
export function toPublicReseller(row: PublicResellerRow): PublicReseller {
  return {
    id: row.id,
    name: row.name,
    neighborhood: row.area,
    landmark: row.landmarkText,
    latitude: row.lat,
    longitude: row.lng,
  };
}
