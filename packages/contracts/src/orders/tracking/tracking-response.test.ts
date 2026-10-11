import { describe, expect, it } from "vitest";
import { TRACKING_TOKEN_HEADER, trackingResponseSchema } from "./tracking-response.js";

const VALID = {
  orderCode: "ABC234",
  status: "CONFIRMED",
  deliveryDate: "2026-10-12",
  landmarkText: "Example landmark",
  totalAr: 12000,
  deliveryFeeAr: 2000,
  itemCount: 3,
  createdAt: "2026-10-08T08:00:00.000Z",
  rejectionReason: null,
  canCancel: true,
} as const;

describe("trackingResponseSchema", () => {
  it("accepts a complete response", () => {
    expect(trackingResponseSchema.parse(VALID)).toEqual(VALID);
  });

  it("accepts a null delivery date and a text reason", () => {
    const parsed = trackingResponseSchema.safeParse({
      ...VALID,
      status: "REJECTED",
      deliveryDate: null,
      rejectionReason: "Out of stock.",
      canCancel: false,
    });
    expect(parsed.success).toBe(true);
  });

  it("refuses a property it does not define, such as a name or a coordinate", () => {
    expect(trackingResponseSchema.safeParse({ ...VALID, contactName: "x" }).success).toBe(false);
    expect(trackingResponseSchema.safeParse({ ...VALID, lat: 1 }).success).toBe(false);
  });

  it("refuses an item count that is not a positive integer", () => {
    for (const itemCount of [0, -1, 1.5]) {
      expect(trackingResponseSchema.safeParse({ ...VALID, itemCount }).success).toBe(false);
    }
  });

  it("refuses a status outside the seven of the model", () => {
    expect(trackingResponseSchema.safeParse({ ...VALID, status: "SHIPPED" }).success).toBe(false);
  });

  it("refuses a delivery date that is not a plain day", () => {
    expect(
      trackingResponseSchema.safeParse({ ...VALID, deliveryDate: "2026-10-12T00:00:00.000Z" })
        .success,
    ).toBe(false);
  });

  it("names the header that carries the token", () => {
    expect(TRACKING_TOKEN_HEADER).toBe("X-Tracking-Token");
  });
});
