import { createResellerRequestSchema } from "@entana/contracts";
import type {
  AdminReseller,
  CreateResellerRequest,
  UpdateResellerRequest,
} from "@entana/contracts";

/** What the person typed: the coordinates stay text until the form is checked. */
export interface ResellerFormValues {
  readonly name: string;
  readonly neighborhood: string;
  readonly landmark: string;
  readonly latitude: string;
  readonly longitude: string;
  readonly consentGiven: boolean;
  readonly visible: boolean;
}

export type ResellerFormField = "name" | "neighborhood" | "landmark" | "latitude" | "longitude";

/** The fields that are refused; the words are in the texts, by field. */
export type ResellerFormErrors = Partial<Record<ResellerFormField, true>>;

/** The fields in the order of the page: the first one in error takes the focus. */
export const RESELLER_FIELD_ORDER: readonly ResellerFormField[] = [
  "name",
  "neighborhood",
  "landmark",
  "latitude",
  "longitude",
];

export interface MapPoint {
  readonly lat: number;
  readonly lng: number;
}

const COORDINATE_PATTERN = /^-?\d+(\.\d+)?$/;
// Six decimals are about ten centimetres: more is noise in a field that a person reads.
const COORDINATE_DECIMALS = 6;

export function emptyResellerForm(): ResellerFormValues {
  return {
    name: "",
    neighborhood: "",
    landmark: "",
    latitude: "",
    longitude: "",
    consentGiven: false,
    visible: false,
  };
}

/** The text of a coordinate as it is shown and typed: a point, no trailing zeros. */
export function coordinateText(value: number): string {
  return String(Number(value.toFixed(COORDINATE_DECIMALS)));
}

export function formValuesOf(reseller: AdminReseller): ResellerFormValues {
  return {
    name: reseller.name,
    neighborhood: reseller.neighborhood,
    landmark: reseller.landmark,
    latitude: coordinateText(reseller.latitude),
    longitude: coordinateText(reseller.longitude),
    consentGiven: reseller.consentGiven,
    visible: reseller.visible,
  };
}

/** A number typed with a point or a comma; null when the text is not one (an empty one too). */
export function parseCoordinate(text: string): number | null {
  const normalised = text.trim().replace(",", ".");
  return COORDINATE_PATTERN.test(normalised) ? Number(normalised) : null;
}

const { shape } = createResellerRequestSchema;

function isCoordinateValid(text: string, schema: typeof shape.latitude): boolean {
  const value = parseCoordinate(text);
  return value !== null && schema.safeParse(value).success;
}

/** The ranges and the lengths are the ones of the shared schema: one source for both sides. */
export function validateResellerForm(values: ResellerFormValues): ResellerFormErrors {
  const checks: Record<ResellerFormField, boolean> = {
    name: shape.name.safeParse(values.name).success,
    neighborhood: shape.neighborhood.safeParse(values.neighborhood).success,
    landmark: shape.landmark.safeParse(values.landmark).success,
    latitude: isCoordinateValid(values.latitude, shape.latitude),
    longitude: isCoordinateValid(values.longitude, shape.longitude),
  };
  const errors: ResellerFormErrors = {};
  for (const field of RESELLER_FIELD_ORDER) {
    if (!checks[field]) {
      errors[field] = true;
    }
  }
  return errors;
}

/** The point of the marker: only when both coordinates are valid numbers. */
export function pointOf(values: ResellerFormValues): MapPoint | null {
  if (!isCoordinateValid(values.latitude, shape.latitude)) {
    return null;
  }
  if (!isCoordinateValid(values.longitude, shape.longitude)) {
    return null;
  }
  const lat = parseCoordinate(values.latitude);
  const lng = parseCoordinate(values.longitude);
  return lat === null || lng === null ? null : { lat, lng };
}

/** Showing the reseller on the map needs the consent of its owner. */
export function canPublish(values: ResellerFormValues): boolean {
  return values.consentGiven;
}

/** The body of a creation: the form was validated, so the point exists. */
export function buildCreateBody(values: ResellerFormValues): CreateResellerRequest | null {
  const point = pointOf(values);
  if (point === null) {
    return null;
  }
  return {
    name: values.name.trim(),
    neighborhood: values.neighborhood.trim(),
    landmark: values.landmark.trim(),
    latitude: point.lat,
    longitude: point.lng,
    consentGiven: values.consentGiven,
    visible: values.visible,
  };
}

/**
 * The fields that changed. The two coordinates go together as soon as one of them changed (the
 * API refuses one alone). Null when nothing changed: there is nothing to send.
 */
export function buildUpdateBody(
  reseller: AdminReseller,
  values: ResellerFormValues,
): UpdateResellerRequest | null {
  const point = pointOf(values);
  if (point === null) {
    return null;
  }
  const name = values.name.trim();
  const neighborhood = values.neighborhood.trim();
  const landmark = values.landmark.trim();
  const isMoved = point.lat !== reseller.latitude || point.lng !== reseller.longitude;
  const changes: UpdateResellerRequest = {
    ...(name !== reseller.name && { name }),
    ...(neighborhood !== reseller.neighborhood && { neighborhood }),
    ...(landmark !== reseller.landmark && { landmark }),
    ...(isMoved && { latitude: point.lat, longitude: point.lng }),
    ...(values.consentGiven !== reseller.consentGiven && { consentGiven: values.consentGiven }),
    ...(values.visible !== reseller.visible && { visible: values.visible }),
  };
  return Object.keys(changes).length === 0 ? null : changes;
}
