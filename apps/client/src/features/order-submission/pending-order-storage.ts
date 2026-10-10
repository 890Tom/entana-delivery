import { createOrderRequestSchema, idempotencyKeySchema } from "@entana/contracts";

import type { OrderAttempt } from "./order-submission-types";

/** Versioned: a change of the stored shape starts a new key, and the old content is ignored. */
export const PENDING_ORDER_STORAGE_ITEM = "entana.pending-order.v1";

const STORAGE_VERSION = 1;
// A request is a few hundred bytes (30 lines about 2 KB): anything near this was not ours.
const MAX_STORED_LENGTH = 8192;
const KEYS = ["version", "key", "token", "request"] as const;
const TOKEN_SCHEMA = createOrderRequestSchema.shape.trackingToken;

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toAttempt(content: unknown): OrderAttempt | null {
  if (!isRecord(content) || Object.keys(content).length !== KEYS.length) {
    return null;
  }
  if (!KEYS.every((key) => key in content) || content.version !== STORAGE_VERSION) {
    return null;
  }
  const key = idempotencyKeySchema.safeParse(content.key);
  const token = TOKEN_SCHEMA.safeParse(content.token);
  const request = createOrderRequestSchema.safeParse(content.request);
  const isConsistent =
    key.success && token.success && request.success && request.data.trackingToken === token.data;
  return isConsistent ? { key: key.data, token: token.data, request: request.data } : null;
}

/** The stored text is untrusted: bounded, strictly validated, and "no attempt" at the first doubt. */
export function readStoredAttempt(): OrderAttempt | null {
  try {
    const stored = window.sessionStorage.getItem(PENDING_ORDER_STORAGE_ITEM);
    if (stored === null || stored.length > MAX_STORED_LENGTH) {
      return null;
    }
    return toAttempt(JSON.parse(stored));
  } catch {
    // Not JSON, or a storage that throws on access (private browsing).
    return null;
  }
}

/**
 * The attempt holds personal data: the session storage only, never the local one. True when it
 * was stored; false means it lives in memory alone.
 */
export function writeStoredAttempt(attempt: OrderAttempt): boolean {
  try {
    window.sessionStorage.setItem(
      PENDING_ORDER_STORAGE_ITEM,
      JSON.stringify({ version: STORAGE_VERSION, ...attempt }),
    );
    return true;
  } catch {
    return false;
  }
}

export function clearStoredAttempt(): void {
  try {
    window.sessionStorage.removeItem(PENDING_ORDER_STORAGE_ITEM);
  } catch {
    // Nothing to forget in a storage that cannot be reached.
  }
}
