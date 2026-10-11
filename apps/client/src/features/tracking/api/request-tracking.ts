import { TRACKING_TOKEN_HEADER, trackingResponseSchema } from "@entana/contracts";
import type { TrackingResponse } from "@entana/contracts";

const TRACKING_ADDRESS = "/api/v1/tracking";
const CANCEL_ADDRESS = "/api/v1/tracking/cancel";
const TIMEOUT_MS = 10_000;

/** The token is unknown, or the order is past its retention: the server says the same. */
export class TrackingNotFoundError extends Error {
  constructor() {
    super("Tracking not found");
  }
}

/** The order can no longer be cancelled. */
export class TrackingConflictError extends Error {
  constructor() {
    super("Tracking conflict");
  }
}

/** A failure that says nothing more than its kind: no response text, no address, no token. */
export class TrackingRequestError extends Error {
  readonly kind: "network" | "timeout" | "server" | "rate_limited" | "unexpected";

  constructor(kind: TrackingRequestError["kind"]) {
    super(`Tracking request failed: ${kind}`);
    this.kind = kind;
  }
}

async function readAnswer(response: Response): Promise<TrackingResponse> {
  if (response.status === 404) {
    throw new TrackingNotFoundError();
  }
  if (response.status === 409) {
    throw new TrackingConflictError();
  }
  if (response.status === 429) {
    throw new TrackingRequestError("rate_limited");
  }
  if (response.status >= 500) {
    throw new TrackingRequestError("server");
  }
  if (!response.ok) {
    throw new TrackingRequestError("unexpected");
  }
  const parsed = trackingResponseSchema.safeParse(await response.json());
  if (!parsed.success) {
    throw new TrackingRequestError("unexpected");
  }
  return parsed.data;
}

function isKnownFailure(error: unknown): boolean {
  return (
    error instanceof TrackingNotFoundError ||
    error instanceof TrackingConflictError ||
    error instanceof TrackingRequestError
  );
}

function classify(error: unknown, isTimedOut: boolean, callerSignal?: AbortSignal): unknown {
  if (isKnownFailure(error)) {
    return error;
  }
  if (isTimedOut) {
    return new TrackingRequestError("timeout");
  }
  if (callerSignal?.aborted === true) {
    // The screen went away on purpose: this is not a failure to report.
    return error;
  }
  // A body that is not JSON is "unexpected"; a failed fetch or a dropped connection is "network".
  return new TrackingRequestError(error instanceof SyntaxError ? "unexpected" : "network");
}

/**
 * The token goes in its header and nowhere else: not the address, not a cookie, not a referrer.
 * The answer is validated with the shared schema.
 */
async function requestTracking(
  method: "GET" | "POST",
  address: string,
  token: string,
  signal?: AbortSignal,
): Promise<TrackingResponse> {
  const timeout = new AbortController();
  const timer = setTimeout(() => {
    timeout.abort();
  }, TIMEOUT_MS);
  const combined =
    signal === undefined ? timeout.signal : AbortSignal.any([signal, timeout.signal]);
  try {
    const response = await fetch(address, {
      method,
      headers: { [TRACKING_TOKEN_HEADER]: token },
      credentials: "omit",
      cache: "no-store",
      referrerPolicy: "no-referrer",
      // A redirect would send the header to another address.
      redirect: "error",
      signal: combined,
    });
    return await readAnswer(response);
  } catch (error: unknown) {
    throw classify(error, timeout.signal.aborted, signal);
  } finally {
    clearTimeout(timer);
  }
}

export function fetchTracking(token: string, signal: AbortSignal): Promise<TrackingResponse> {
  return requestTracking("GET", TRACKING_ADDRESS, token, signal);
}

/** Idempotent on the server: sending it again after a failure is safe. */
export function cancelTracking(token: string): Promise<TrackingResponse> {
  return requestTracking("POST", CANCEL_ADDRESS, token);
}
