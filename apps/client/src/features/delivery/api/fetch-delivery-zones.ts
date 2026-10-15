import { deliveryZoneListResponseSchema } from "@entana/contracts";
import type { DeliveryZoneListResponse } from "@entana/contracts";

import { fetchValidated } from "../../../data-fetching/fetch-validated";
import type { RequestErrorKind } from "../../../data-fetching/fetch-validated";

/** Carries only a kind: no response text, no status, no URL can leak through it. */
class DeliveryZonesError extends Error {
  readonly kind: RequestErrorKind;

  constructor(kind: RequestErrorKind) {
    super(`Delivery zones request failed: ${kind}`);
    this.name = "DeliveryZonesError";
    this.kind = kind;
  }
}

/** GET the public circles of the delivery places. The request carries nothing about the customer. */
export function fetchDeliveryZones(signal?: AbortSignal): Promise<DeliveryZoneListResponse> {
  return fetchValidated({
    url: "/api/v1/delivery/zones",
    schema: deliveryZoneListResponseSchema,
    signal,
    createError: (kind) => new DeliveryZonesError(kind),
  });
}
