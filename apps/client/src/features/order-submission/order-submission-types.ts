import type { CreateOrderRequest } from "@entana/contracts";

/**
 * The fields of the request a screen can point at: a closed set, in the order of the form. The
 * API's pointers are mapped onto it and any other pointer is ignored.
 */
export const ORDER_FIELDS = [
  "phone",
  "contactName",
  "customerNote",
  "landmarkText",
  "location",
  "items",
] as const;

export type OrderField = (typeof ORDER_FIELDS)[number];

/** Errors that say nothing more than their type. */
export type PlainErrorType =
  | "offline"
  | "network"
  | "timeout"
  | "rate_limited"
  | "service_unavailable"
  | "server"
  | "blocked"
  // Final, and kept so: the key was used for another request, so the screen must offer no
  // "retry" for this type (a retry would be refused again).
  | "conflict"
  // The server answered 2xx but the answer cannot be read: the order may exist. The attempt is
  // kept so that a replay with the same key returns it instead of making a second one.
  | "unconfirmed"
  | "order_too_large"
  | "unexpected";

/** No response text is ever kept: only a type, field names or product ids the client sent. */
export type OrderSubmissionError =
  | { readonly type: "invalid_draft" | "validation"; readonly fields: readonly OrderField[] }
  | { readonly type: "unavailable_products"; readonly productIds: readonly string[] }
  | { readonly type: PlainErrorType };

export interface OrderConfirmation {
  readonly status: "confirmed";
  readonly orderCode: string;
  readonly totalAr: number;
  readonly createdAt: string;
}

export type OrderSubmissionResult =
  OrderConfirmation | { readonly status: "error"; readonly error: OrderSubmissionError };

export type OrderSubmissionState =
  { readonly status: "idle" } | { readonly status: "sending" } | OrderSubmissionResult;

/** What is kept between two tries of one order: the same key and token, the same body. */
export interface OrderAttempt {
  readonly key: string;
  readonly token: string;
  readonly request: CreateOrderRequest;
}

const REPLAYABLE: readonly OrderSubmissionError["type"][] = [
  "offline",
  "network",
  "timeout",
  "rate_limited",
  "service_unavailable",
  "server",
  "unconfirmed",
];

/** The attempt is kept and may be replayed with the same key; any other error is final. */
export function isReplayable(error: OrderSubmissionError): boolean {
  return REPLAYABLE.includes(error.type);
}

/**
 * Only after these does the return of the network replay the order by itself: the others (a
 * limit, a server error, an unreadable answer) wait for the customer's own retry.
 */
const NETWORK_RETURN_REPLAYS: readonly OrderSubmissionError["type"][] = [
  "offline",
  "network",
  "timeout",
];

export function isReplayedOnNetworkReturn(error: OrderSubmissionError): boolean {
  return NETWORK_RETURN_REPLAYS.includes(error.type);
}
