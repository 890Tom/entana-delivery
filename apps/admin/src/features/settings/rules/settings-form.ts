import { updateDeliverySettingsRequestSchema } from "@entana/contracts";
import type {
  DeliverySettings,
  DeliverySettingsField,
  UpdateDeliverySettingsRequest,
} from "@entana/contracts";

/** The text of each field of a form: the numbers are the digits typed, with no separator. */
export type SettingsFormValues = Partial<Readonly<Record<DeliverySettingsField, string>>>;

/** The kinds of error a field shows; the words are in the texts. */
export type SettingsFieldError = "invalid" | "empty" | "tooLong";

export type SettingsFormErrors = Partial<
  Readonly<Record<DeliverySettingsField, SettingsFieldError>>
>;

export type SettingsPatchPlan =
  | { readonly kind: "unchanged" }
  | { readonly kind: "invalid"; readonly errors: SettingsFormErrors }
  | { readonly kind: "ready"; readonly body: UpdateDeliverySettingsRequest };

/** What a count field keeps of a typed or pasted text: digits only (the schema sets the bounds). */
export function readCountInput(text: string): string {
  return text.replace(/\D/g, "");
}

export function formValuesOf(settings: DeliverySettings): Required<SettingsFormValues> {
  return {
    outOfAxisFeeAr: String(settings.outOfAxisFeeAr),
    freeDeliveryMinPieces: String(settings.freeDeliveryMinPieces),
    outOfAxisMessage: settings.outOfAxisMessage,
  };
}

/** What the request would hold for the text of a field: an empty number is no number. */
function requestValueOf(field: DeliverySettingsField, text: string): number | string {
  if (field === "outOfAxisMessage") {
    return text;
  }
  return text.trim() === "" ? Number.NaN : Number(text);
}

/** The fields whose text differs from the saved value, with what the request would hold. */
function changesOf(
  saved: DeliverySettings,
  values: SettingsFormValues,
): [DeliverySettingsField, number | string][] {
  return Object.entries(values).flatMap(([key, text]) => {
    // The keys of the values are fields by their type: `Object.entries` only widens them.
    const field = key as DeliverySettingsField;
    const value = requestValueOf(field, text);
    return value === saved[field] ? [] : [[field, value]];
  });
}

export function hasChanges(saved: DeliverySettings, values: SettingsFormValues): boolean {
  return changesOf(saved, values).length > 0;
}

function errorOf(field: DeliverySettingsField, values: SettingsFormValues): SettingsFieldError {
  if (field !== "outOfAxisMessage") {
    return "invalid";
  }
  return values.outOfAxisMessage?.trim() === "" ? "empty" : "tooLong";
}

/**
 * The PATCH of the settings: only the fields that changed, checked with the shared schema, so
 * that a refused value never leaves the browser.
 */
export function planSettingsPatch(
  saved: DeliverySettings,
  values: SettingsFormValues,
): SettingsPatchPlan {
  const changes = changesOf(saved, values);
  if (changes.length === 0) {
    return { kind: "unchanged" };
  }
  const parsed = updateDeliverySettingsRequestSchema.safeParse(Object.fromEntries(changes));
  if (parsed.success) {
    return { kind: "ready", body: parsed.data };
  }
  const fields = new Set(parsed.error.issues.map((issue) => issue.path[0]));
  const errors = Object.fromEntries(
    changes
      .filter(([field]) => fields.has(field))
      .map(([field]) => [field, errorOf(field, values)]),
  );
  return { kind: "invalid", errors };
}
