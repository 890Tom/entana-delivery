import type { TrackingResponse } from "@entana/contracts";

export const TRACKING_PATH = "/api/v1/tracking";
export const CANCEL_PATH = "/api/v1/tracking/cancel";
export const TRACKING_HEADER = "X-Tracking-Token";

/** The same 3 headers on every answer of the tracking routes, success or error. */
export const TRACKING_RESPONSE_HEADERS = {
  "cache-control": "no-store",
  "x-robots-tag": "noindex",
  "referrer-policy": "no-referrer",
} as const;

export const FIXED_404 = {
  type: "about:blank",
  title: "Not Found",
  status: 404,
  detail: "The requested resource was not found.",
  instance: TRACKING_PATH,
} as const;

/** Obviously fake. */
export const FAKE_VIEW: TrackingResponse = {
  orderCode: "ABC234",
  status: "CONFIRMED",
  deliveryDate: "2026-10-12",
  landmarkText: "Example landmark",
  totalAr: 12000,
  deliveryFeeAr: 0,
  createdAt: "2026-10-08T08:00:00.000Z",
  rejectionReason: null,
  canCancel: true,
};
