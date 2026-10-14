import type { DeliverySettings } from "@entana/contracts";
import type { PrismaClient } from "@entana/database";
import type { StoredAxis, StoredPlace } from "../rules/to-admin-delivery.js";

/** What the queries need from the client: the PrismaClient and its transaction client both fit. */
export type AdminDeliveryDatabase = Pick<
  PrismaClient,
  "deliveryAxis" | "place" | "shopSetting" | "auditLog"
>;

// An explicit allow-list of the columns the administration reads and shows.
const PLACE_SELECT = {
  id: true,
  name: true,
  lat: true,
  lng: true,
  radiusM: true,
  active: true,
} as const;

const SETTINGS_SELECT = {
  outOfAxisFeeAr: true,
  freeDeliveryMinPieces: true,
  outOfAxisMessage: true,
} as const;

/** The single row of the settings (`id = 1`, enforced by ck_shop_setting_single_row_and_fee). */
const SETTINGS_ID = 1;

/** The audit of the settings points at this fixed id: the row has an integer key, not a uuid. */
const SHOP_SETTING_AUDIT_ENTITY_ID = "00000000-0000-0000-0000-000000000001";

/** Every axis, active or not, by rank, with its places in the order of their positions. */
export function listAxesWithPlaces(database: AdminDeliveryDatabase): Promise<StoredAxis[]> {
  return database.deliveryAxis.findMany({
    select: {
      id: true,
      name: true,
      rank: true,
      colorKey: true,
      active: true,
      places: {
        select: { position: true, place: { select: PLACE_SELECT } },
        orderBy: { position: "asc" },
      },
    },
    orderBy: { rank: "asc" },
  });
}

/** The active places by name; the id makes the order total. */
export function listActivePlaces(database: AdminDeliveryDatabase): Promise<StoredPlace[]> {
  return database.place.findMany({
    where: { active: true },
    select: PLACE_SELECT,
    orderBy: [{ name: "asc" }, { id: "asc" }],
  });
}

export function findSettings(database: AdminDeliveryDatabase): Promise<DeliverySettings> {
  return database.shopSetting.findUniqueOrThrow({
    where: { id: SETTINGS_ID },
    select: SETTINGS_SELECT,
  });
}

export function updateSettings(
  database: AdminDeliveryDatabase,
  data: Partial<DeliverySettings>,
): Promise<DeliverySettings> {
  return database.shopSetting.update({
    where: { id: SETTINGS_ID },
    data,
    select: SETTINGS_SELECT,
  });
}

/** What the audit may hold: field names and numbers, never the text of the message. */
export interface DeliverySettingsAudit {
  readonly actorId: string;
  readonly diff: {
    readonly fields: readonly string[];
    readonly outOfAxisFeeAr?: { readonly from: number; readonly to: number };
    readonly freeDeliveryMinPieces?: { readonly from: number; readonly to: number };
  };
}

export async function insertSettingsAudit(
  database: AdminDeliveryDatabase,
  audit: DeliverySettingsAudit,
): Promise<void> {
  await database.auditLog.create({
    data: {
      actorId: audit.actorId,
      action: "delivery_settings.updated",
      entity: "shop_setting",
      entityId: SHOP_SETTING_AUDIT_ENTITY_ID,
      diff: audit.diff,
    },
    select: { id: true },
  });
}
