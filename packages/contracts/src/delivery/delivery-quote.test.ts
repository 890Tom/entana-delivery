import { describe, expect, it } from "vitest";
import {
  MAX_ORDER_LINE_QUANTITY,
  MAX_ORDER_LINES,
} from "../orders/request/create-order-request.js";
import { deliveryQuoteRequestSchema, deliveryQuoteResponseSchema } from "./delivery-quote.js";

const REQUEST = { latitude: -18.9, longitude: 47.5, pieces: 3 };
const LARGEST_ORDER = MAX_ORDER_LINES * MAX_ORDER_LINE_QUANTITY;

describe("deliveryQuoteRequestSchema", () => {
  it("accepts a point and a number of pieces", () => {
    expect(deliveryQuoteRequestSchema.parse(REQUEST)).toEqual(REQUEST);
  });

  it.each([
    ["a missing latitude", { longitude: 47.5, pieces: 1 }],
    ["a latitude above 90", { ...REQUEST, latitude: 90.1 }],
    ["a longitude below -180", { ...REQUEST, longitude: -180.1 }],
    ["a latitude sent as text", { ...REQUEST, latitude: "-18.9" }],
    ["pieces of 0", { ...REQUEST, pieces: 0 }],
    ["fractional pieces", { ...REQUEST, pieces: 1.5 }],
    ["an unknown property", { ...REQUEST, feeAr: 0 }],
  ])("refuses %s", (_name, body) => {
    expect(deliveryQuoteRequestSchema.safeParse(body).success).toBe(false);
  });

  it("accepts the largest order and refuses one piece more", () => {
    expect(
      deliveryQuoteRequestSchema.safeParse({ ...REQUEST, pieces: LARGEST_ORDER }).success,
    ).toBe(true);
    expect(
      deliveryQuoteRequestSchema.safeParse({ ...REQUEST, pieces: LARGEST_ORDER + 1 }).success,
    ).toBe(false);
  });
});

describe("deliveryQuoteResponseSchema", () => {
  const outOfAxis = {
    feeAr: 4000,
    reason: "out_of_axis",
    placeName: null,
    outOfAxisMessage: "Hors axe.",
    freeDeliveryMinPieces: 20,
  };

  it("accepts an out-of-axis quote", () => {
    expect(deliveryQuoteResponseSchema.parse(outOfAxis)).toEqual(outOfAxis);
  });

  it.each([
    ["a negative fee", { feeAr: -1 }],
    ["an unknown reason", { reason: "adjusted" }],
    ["an extra property", { axisId: "x" }],
  ])("refuses %s", (_name, change) => {
    expect(deliveryQuoteResponseSchema.safeParse({ ...outOfAxis, ...change }).success).toBe(false);
  });
});
