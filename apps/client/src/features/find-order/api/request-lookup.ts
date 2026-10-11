import { trackingResponseSchema } from "@entana/contracts";
import type { TrackingLookupRequest, TrackingResponse } from "@entana/contracts";

const LOOKUP_ADDRESS = "/api/v1/tracking/lookup";
const TIMEOUT_MS = 10_000;

/**
 * What the lookup came to. A failure says only its kind: no response text, no address, and never
 * the phone number or the code.
 */
export type LookupResult =
  | { readonly kind: "ok"; readonly view: TrackingResponse }
  | { readonly kind: "invalid_phone" | "not_found" | "rate_limited" | "failure" };

const BY_STATUS: Readonly<Record<number, LookupResult>> = {
  400: { kind: "invalid_phone" },
  404: { kind: "not_found" },
  429: { kind: "rate_limited" },
};

async function readAnswer(response: Response): Promise<LookupResult> {
  const known = BY_STATUS[response.status];
  if (known !== undefined) {
    return known;
  }
  if (!response.ok) {
    return { kind: "failure" };
  }
  // An answer that is not the tracking view is a failure, never shown in part.
  const parsed = trackingResponseSchema.safeParse(await response.json());
  return parsed.success ? { kind: "ok", view: parsed.data } : { kind: "failure" };
}

/**
 * Looks an order up by phone number and code. The values travel in the body only: not the
 * address, not a header, not a referrer. Never throws, and never tries again by itself: a
 * limited address is not helped by more attempts.
 */
export async function lookupOrder(request: TrackingLookupRequest): Promise<LookupResult> {
  const timeout = new AbortController();
  const timer = setTimeout(() => {
    timeout.abort();
  }, TIMEOUT_MS);
  try {
    const response = await fetch(LOOKUP_ADDRESS, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
      credentials: "omit",
      cache: "no-store",
      referrerPolicy: "no-referrer",
      // A redirect would send the body to another address.
      redirect: "error",
      signal: timeout.signal,
    });
    return await readAnswer(response);
  } catch {
    return { kind: "failure" };
  } finally {
    clearTimeout(timer);
  }
}
