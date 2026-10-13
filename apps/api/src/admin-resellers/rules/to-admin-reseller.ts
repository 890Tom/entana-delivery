import type { AdminReseller, ResellerState } from "@entana/contracts";

/** A reseller row as the queries select it, with the column names of the table. */
export interface StoredAdminReseller {
  readonly id: string;
  readonly name: string;
  readonly area: string;
  readonly landmarkText: string;
  readonly lat: number;
  readonly lng: number;
  readonly active: boolean;
  readonly consentAt: Date | null;
  readonly verifiedAt: Date | null;
}

/** The names of the contract on the columns: neighborhood is `area`, visible is `active`... */
export function toAdminReseller(row: StoredAdminReseller): AdminReseller {
  return {
    id: row.id,
    name: row.name,
    neighborhood: row.area,
    landmark: row.landmarkText,
    latitude: row.lat,
    longitude: row.lng,
    consentGiven: row.consentAt !== null,
    visible: row.active,
    verifiedAt: row.verifiedAt === null ? null : row.verifiedAt.toISOString(),
  };
}

export function toResellerState(row: StoredAdminReseller): ResellerState {
  return {
    name: row.name,
    neighborhood: row.area,
    landmark: row.landmarkText,
    latitude: row.lat,
    longitude: row.lng,
    consentGiven: row.consentAt !== null,
    visible: row.active,
  };
}
