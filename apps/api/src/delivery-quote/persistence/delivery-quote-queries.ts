import type { DeliverySettings } from "@entana/contracts";
import type { PrismaClient } from "@entana/database";
import type { QuotableAxis } from "../rules/quote-delivery.js";

/** What the queries need: the PrismaClient and a transaction client both fit. */
export type DeliveryQuoteReader = Pick<PrismaClient, "deliveryAxis" | "shopSetting">;

/** The single row of the settings (`id = 1`, enforced by ck_shop_setting_single_row_and_fee). */
const SETTINGS_ID = 1;

/** The active axes with their active places: what the rule may match, and the place names. */
export function listActiveAxes(database: DeliveryQuoteReader): Promise<QuotableAxis[]> {
  return database.deliveryAxis.findMany({
    where: { active: true },
    select: {
      id: true,
      rank: true,
      active: true,
      places: {
        where: { place: { active: true } },
        select: {
          place: {
            select: { id: true, name: true, lat: true, lng: true, radiusM: true, active: true },
          },
        },
      },
    },
  });
}

export function findDeliverySettings(database: DeliveryQuoteReader): Promise<DeliverySettings> {
  return database.shopSetting.findUniqueOrThrow({
    where: { id: SETTINGS_ID },
    select: { outOfAxisFeeAr: true, freeDeliveryMinPieces: true, outOfAxisMessage: true },
  });
}
