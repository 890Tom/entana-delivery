import { describe, expect, it } from "vitest";
import type { CreateOrderRequest } from "@entana/contracts";
import {
  FAKE_CONTACT_NAME,
  FAKE_LANDMARK,
  FAKE_LAT,
  FAKE_LNG,
  FAKE_NOTE,
  FAKE_PHONE_E164,
  buildOrderRequest,
} from "../../../tests/support/order-request.js";
import { hashTrackingToken } from "./hash-tracking-token.js";
import { matchesStoredOrder, toCreateOrderResponse } from "./matches-stored-order.js";
import type { StoredOrder } from "./matches-stored-order.js";

const FIRST = "3b241101-e2bb-4255-8caf-4136c566a962";
const SECOND = "0190a5b2-7c3d-7e4f-8a1b-2c3d4e5f6a7b";

const request = (overrides: Partial<CreateOrderRequest> = {}): CreateOrderRequest => {
  return buildOrderRequest(
    [
      { productId: FIRST, quantity: 2 },
      { productId: SECOND, quantity: 1 },
    ],
    { trackingToken: "t".repeat(43), ...overrides },
  );
};

const storedFor = (
  original: CreateOrderRequest,
  changes: Partial<StoredOrder> = {},
): StoredOrder => {
  return {
    publicCode: "ABCDEF",
    totalAr: 12000,
    createdAt: new Date("2026-10-08T08:00:00.000Z"),
    publicTokenHash: hashTrackingToken(original.trackingToken),
    contactName: original.contactName,
    customerNote: original.customerNote ?? null,
    landmarkText: original.landmarkText,
    lat: original.location.lat,
    lng: original.location.lng,
    customer: { phoneE164: FAKE_PHONE_E164 },
    items: original.items.map((item) => ({ productId: item.productId, qty: item.quantity })),
    ...changes,
  };
};

const matches = (stored: StoredOrder, incoming: CreateOrderRequest): boolean => {
  return matchesStoredOrder(stored, incoming, FAKE_PHONE_E164);
};

describe("matchesStoredOrder", () => {
  it("accepts the request the order was created from", () => {
    expect(matches(storedFor(request()), request())).toBe(true);
  });

  it("ignores the order of the items", () => {
    const reversed = request({ items: [...request().items].reverse() });
    expect(matches(storedFor(request()), reversed)).toBe(true);
  });

  it("treats an absent note and a null note as the same", () => {
    const rest = { ...request(), customerNote: undefined };
    expect(matches(storedFor(request(), { customerNote: null }), rest)).toBe(true);
  });

  it("compares a product id without regard to case", () => {
    const upper = request({
      items: [
        { productId: FIRST.toUpperCase(), quantity: 2 },
        { productId: SECOND, quantity: 1 },
      ],
    });
    expect(matches(storedFor(request()), upper)).toBe(true);
  });

  it.each<[string, Partial<CreateOrderRequest>]>([
    ["a contact name", { contactName: `${FAKE_CONTACT_NAME} 2` }],
    ["a note", { customerNote: `${FAKE_NOTE} 2` }],
    ["a missing note", { customerNote: "" }],
    ["a landmark", { landmarkText: `${FAKE_LANDMARK} 2` }],
    ["a latitude", { location: { lat: FAKE_LAT + 0.0001, lng: FAKE_LNG } }],
    ["a longitude", { location: { lat: FAKE_LAT, lng: FAKE_LNG + 0.0001 } }],
    ["a token", { trackingToken: "u".repeat(43) }],
    [
      "a quantity",
      {
        items: [
          { productId: FIRST, quantity: 3 },
          { productId: SECOND, quantity: 1 },
        ],
      },
    ],
    [
      "a product",
      {
        items: [
          { productId: FIRST, quantity: 2 },
          { productId: "11111111-1111-4111-8111-111111111111", quantity: 1 },
        ],
      },
    ],
    ["a missing item", { items: [{ productId: FIRST, quantity: 2 }] }],
  ])("refuses %s that differs", (_name, change) => {
    expect(matches(storedFor(request()), request(change))).toBe(false);
  });

  it("refuses another phone number", () => {
    expect(matchesStoredOrder(storedFor(request()), request(), "+261340000000")).toBe(false);
  });

  it("refuses an order with an extra item", () => {
    const stored = storedFor(request(), {
      items: [
        ...storedFor(request()).items,
        { productId: "11111111-1111-4111-8111-111111111111", qty: 1 },
      ],
    });
    expect(matches(stored, request())).toBe(false);
  });
});

describe("toCreateOrderResponse", () => {
  it("returns only the order code, NEW, the total and the creation instant", () => {
    expect(toCreateOrderResponse(storedFor(request()))).toEqual({
      orderCode: "ABCDEF",
      status: "NEW",
      totalAr: 12000,
      createdAt: "2026-10-08T08:00:00.000Z",
    });
  });
});
