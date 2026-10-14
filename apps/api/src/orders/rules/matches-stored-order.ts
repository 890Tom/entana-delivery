import type { CreateOrderRequest, CreateOrderResponse } from "@entana/contracts";
import { hashTrackingToken } from "./hash-tracking-token.js";

/** The columns of a stored order that an idempotent replay is compared on, and answered from. */
export interface StoredOrder {
  readonly publicCode: string;
  readonly totalAr: number;
  readonly deliveryFee: number;
  readonly createdAt: Date;
  readonly publicTokenHash: string;
  readonly contactName: string;
  readonly customerNote: string | null;
  readonly landmarkText: string;
  readonly lat: number;
  readonly lng: number;
  readonly customer: { readonly phoneE164: string };
  readonly items: readonly { readonly productId: string; readonly qty: number }[];
}

// "productId:quantity" lines, lower-cased because a uuid is accepted in both cases, and sorted:
// the order of the lines does not matter. A product is never twice in a request (the schema).
function describeLines(lines: readonly { productId: string; quantity: number }[]): string {
  return lines
    .map((line) => `${line.productId.toLowerCase()}:${String(line.quantity)}`)
    .sort()
    .join(",");
}

function hasSameLines(stored: StoredOrder, request: CreateOrderRequest): boolean {
  const storedLines = stored.items.map((item) => ({
    productId: item.productId,
    quantity: item.qty,
  }));
  return describeLines(storedLines) === describeLines(request.items);
}

/**
 * Whether a request is the one the stored order was created from. Only fields the client chose
 * are compared: never a price or a name, which the server read at creation. The token is compared
 * by its hash. An absent note equals a null note. `normalizedPhone` is the E.164 form of the
 * request's phone. Pure: no value is copied anywhere.
 */
export function matchesStoredOrder(
  stored: StoredOrder,
  request: CreateOrderRequest,
  normalizedPhone: string,
): boolean {
  return (
    stored.customer.phoneE164 === normalizedPhone &&
    stored.contactName === request.contactName &&
    stored.customerNote === (request.customerNote ?? null) &&
    stored.landmarkText === request.landmarkText &&
    stored.lat === request.location.lat &&
    stored.lng === request.location.lng &&
    stored.publicTokenHash === hashTrackingToken(request.trackingToken) &&
    hasSameLines(stored, request)
  );
}

/** The response of a creation, the same for the first answer and for every replay. */
export function toCreateOrderResponse(stored: StoredOrder): CreateOrderResponse {
  return {
    orderCode: stored.publicCode,
    status: "NEW",
    totalAr: stored.totalAr,
    deliveryFeeAr: stored.deliveryFee,
    createdAt: stored.createdAt.toISOString(),
  };
}
