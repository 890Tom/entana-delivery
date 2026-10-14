import { createOrderRequestSchema } from "@entana/contracts";

import type { OrderDrafts } from "../../features/order-submission/request/build-order-request";
import type { OrderAttempt } from "../../features/order-submission/order-submission-types";

import { buildProductId } from "./build-product";

const ATTEMPT_KEY = "11111111-1111-4111-8111-111111111111";
const ATTEMPT_TOKEN = "A".repeat(43);

/** Complete, valid drafts: what the screen holds when the customer may send the order. */
export function buildDrafts(overrides: Partial<OrderDrafts> = {}): OrderDrafts {
  return {
    lines: [{ productId: buildProductId(1), quantity: 2 }],
    point: { lat: -18.912346, lng: 47.512346 },
    landmark: "Portail bleu",
    name: "Rakoto Jean",
    phone: "34 12 345 67",
    note: "",
    countryCode: "261",
    ...overrides,
  };
}

export function buildAttempt(overrides: Partial<OrderAttempt> = {}): OrderAttempt {
  return {
    key: ATTEMPT_KEY,
    token: ATTEMPT_TOKEN,
    request: createOrderRequestSchema.parse({
      phone: "+261341234567",
      trackingToken: ATTEMPT_TOKEN,
      contactName: "Rakoto Jean",
      landmarkText: "Portail bleu",
      location: { lat: -18.912346, lng: 47.512346 },
      items: [{ productId: buildProductId(1), quantity: 2 }],
    }),
    ...overrides,
  };
}

/** A 201 as the API answers it. */
export const CREATED_BODY = {
  orderCode: "K7M2QX",
  status: "NEW",
  totalAr: 9000,
  deliveryFeeAr: 0,
  createdAt: "2026-10-10T08:30:00.000Z",
} as const;
