import type { DeliveryQuoteResponse, DeliveryZone } from "@entana/contracts";

/** A free delivery inside an axis, at a fake place, unless the test says otherwise. */
export function buildDeliveryQuote(
  overrides: Partial<DeliveryQuoteResponse> = {},
): DeliveryQuoteResponse {
  return {
    feeAr: 0,
    reason: "axis",
    placeName: "Quartier Démo",
    outOfAxisMessage: null,
    freeDeliveryMinPieces: 10,
    ...overrides,
  };
}

/** The fee of a point out of every axis, with the message the shop wrote for it. */
export function buildOutOfAxisQuote(
  overrides: Partial<DeliveryQuoteResponse> = {},
): DeliveryQuoteResponse {
  return buildDeliveryQuote({
    feeAr: 3000,
    reason: "out_of_axis",
    placeName: null,
    outOfAxisMessage: "Hors zone démo",
    ...overrides,
  });
}

export function buildDeliveryZone(overrides: Partial<DeliveryZone> = {}): DeliveryZone {
  return {
    id: "0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b",
    name: "Quartier Démo",
    latitude: -18.9,
    longitude: 47.52,
    radiusM: 800,
    ...overrides,
  };
}
