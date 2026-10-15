import { deliveryQuoteResponseSchema } from "@entana/contracts";
import type { DeliveryQuoteRequest, DeliveryQuoteResponse } from "@entana/contracts";

import { fetchValidated } from "../../../data-fetching/fetch-validated";
import type { RequestErrorKind } from "../../../data-fetching/fetch-validated";

/** Carries only a kind: no response text, no status, no URL, never the point. */
class DeliveryQuoteError extends Error {
  readonly kind: RequestErrorKind;

  constructor(kind: RequestErrorKind) {
    super(`Delivery quote request failed: ${kind}`);
    this.name = "DeliveryQuoteError";
    this.kind = kind;
  }
}

/**
 * POST the point and the pieces of the cart: the server says what the delivery would cost. The
 * point travels in the body only, never in the address. No amount is sent: the server decides.
 */
export function fetchDeliveryQuote(
  request: DeliveryQuoteRequest,
  signal?: AbortSignal,
): Promise<DeliveryQuoteResponse> {
  return fetchValidated({
    url: "/api/v1/delivery/quote",
    schema: deliveryQuoteResponseSchema,
    body: request,
    signal,
    createError: (kind) => new DeliveryQuoteError(kind),
  });
}
