import type { DeliverySettings } from "../delivery-settings.js";
import type { UpdateDeliverySettingsRequest } from "./delivery-settings-request.js";

export type DeliverySettingsField = keyof DeliverySettings;
type NumberField = "outOfAxisFeeAr" | "freeDeliveryMinPieces";

interface Change {
  readonly from: number;
  readonly to: number;
}

export type DeliverySettingsUpdatePlan =
  | { readonly kind: "unchanged" }
  | {
      readonly kind: "changed";
      /** The columns to write: only the values that really change. */
      readonly columns: Partial<DeliverySettings>;
      /** The names of the fields that change, in a fixed order. */
      readonly fields: readonly DeliverySettingsField[];
      /** Before and after of the numbers; the message text is never part of a plan to audit. */
      readonly numbers: Partial<Record<NumberField, Change>>;
    };

const FIELDS: readonly DeliverySettingsField[] = [
  "outOfAxisFeeAr",
  "freeDeliveryMinPieces",
  "outOfAxisMessage",
];
const NUMBER_FIELDS: readonly NumberField[] = ["outOfAxisFeeAr", "freeDeliveryMinPieces"];

/** What a partial change does to the settings: only the values that differ are written. */
export function planDeliverySettingsUpdate(
  before: DeliverySettings,
  request: UpdateDeliverySettingsRequest,
): DeliverySettingsUpdatePlan {
  const fields = FIELDS.filter((field) => {
    const value = request[field];
    return value !== undefined && value !== before[field];
  });
  if (fields.length === 0) {
    return { kind: "unchanged" };
  }
  const columns = Object.fromEntries(fields.map((field) => [field, request[field]]));
  const numbers = Object.fromEntries(
    NUMBER_FIELDS.filter((field) => fields.includes(field)).map((field) => [
      field,
      { from: before[field], to: request[field] },
    ]),
  );
  return { kind: "changed", columns, fields, numbers };
}
