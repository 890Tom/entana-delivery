import { createOrderRequestSchema } from "@entana/contracts";

import type { GeoPoint } from "../map/map-adapter";
import { toDeliveryPoint } from "../rules/to-delivery-point";

/** What the customer has chosen so far. The landmark is "" until a valid one is typed. */
export interface DeliveryDraft {
  readonly point: GeoPoint | null;
  readonly landmark: string;
}

export const EMPTY_DRAFT: DeliveryDraft = { point: null, landmark: "" };

/** Versioned: a change of the stored shape starts a new key, and the old content is ignored. */
export const DELIVERY_DRAFT_STORAGE_KEY = "entana.delivery.v1";

const STORAGE_VERSION = 1;
// A draft is a point and 200 characters: anything longer is not ours, and is not even parsed.
const MAX_STORED_LENGTH = 2048;
const LANDMARK_SCHEMA = createOrderRequestSchema.shape.landmarkText;

const hasExactKeys = (value: object, keys: readonly string[]): boolean => {
  const own = Object.keys(value);
  return own.length === keys.length && keys.every((key) => own.includes(key));
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** A point of the stored content, checked like a point placed by hand; null when it is not. */
function parsePoint(value: unknown): GeoPoint | null | undefined {
  if (value === null) {
    return null;
  }
  if (!isRecord(value) || !hasExactKeys(value, ["lat", "lng"])) {
    return undefined;
  }
  const { lat, lng } = value;
  if (typeof lat !== "number" || typeof lng !== "number") {
    return undefined;
  }
  return toDeliveryPoint(lat, lng) ?? undefined;
}

function parseLandmark(value: unknown): string | undefined {
  if (value === null) {
    return "";
  }
  return typeof value === "string" && LANDMARK_SCHEMA.safeParse(value).success ? value : undefined;
}

/**
 * The stored content is untrusted input: bounded before it is parsed, then checked key by key.
 * Anything that is not exactly what was written gives an empty draft, without an error.
 */
export function parseStoredDraft(raw: string | null): DeliveryDraft {
  if (raw === null || raw.length > MAX_STORED_LENGTH) {
    return EMPTY_DRAFT;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return EMPTY_DRAFT;
  }
  if (!isRecord(parsed) || !hasExactKeys(parsed, ["version", "point", "landmark"])) {
    return EMPTY_DRAFT;
  }
  const point = parsePoint(parsed.point);
  const landmark = parseLandmark(parsed.landmark);
  if (parsed.version !== STORAGE_VERSION || point === undefined || landmark === undefined) {
    return EMPTY_DRAFT;
  }
  return { point, landmark };
}

/** A landmark still being typed that the contract refuses is stored as nothing, not as text. */
export function serializeDraft(draft: DeliveryDraft): string {
  const isStorable = LANDMARK_SCHEMA.safeParse(draft.landmark).success;
  return JSON.stringify({
    version: STORAGE_VERSION,
    point: draft.point,
    landmark: isStorable ? draft.landmark : null,
  });
}

/** Private browsing or a blocked storage makes even reaching `sessionStorage` throw. */
export function readStoredDraft(): DeliveryDraft {
  try {
    return parseStoredDraft(window.sessionStorage.getItem(DELIVERY_DRAFT_STORAGE_KEY));
  } catch {
    return EMPTY_DRAFT;
  }
}

export function writeStoredDraft(draft: DeliveryDraft): void {
  try {
    window.sessionStorage.setItem(DELIVERY_DRAFT_STORAGE_KEY, serializeDraft(draft));
  } catch {
    // Quota or private browsing: the draft goes on living in memory.
  }
}

export function clearStoredDraft(): void {
  try {
    window.sessionStorage.removeItem(DELIVERY_DRAFT_STORAGE_KEY);
  } catch {
    // Nothing more can be done: the draft is emptied in memory.
  }
}
