import { randomBytes } from "node:crypto";
import type { CreateOrderRequest } from "@entana/contracts";

/** Distinctive fake personal data: a test searches errors and logs for these exact strings. */
export const FAKE_PHONE_INPUT = "034 98 765 43";
export const FAKE_PHONE_E164 = "+261349876543";
export const FAKE_CONTACT_NAME = "Zanakolona Fakeperson";
export const FAKE_NOTE = "fake-note: sonner trois fois";
export const FAKE_LANDMARK = "fake-landmark: pres du baobab gris";
export const FAKE_LAT = -18.912345;
export const FAKE_LNG = 47.512345;

/** 32 random bytes in base64url, as a client generates them: 43 characters. */
export function generateTrackingToken(): string {
  return randomBytes(32).toString("base64url");
}

/** A valid request for the given products; `overrides` changes one thing at a time. */
export function buildOrderRequest(
  items: CreateOrderRequest["items"],
  overrides: Partial<CreateOrderRequest> = {},
): CreateOrderRequest {
  return {
    phone: FAKE_PHONE_INPUT,
    trackingToken: generateTrackingToken(),
    contactName: FAKE_CONTACT_NAME,
    customerNote: FAKE_NOTE,
    landmarkText: FAKE_LANDMARK,
    location: { lat: FAKE_LAT, lng: FAKE_LNG },
    items,
    ...overrides,
  };
}
