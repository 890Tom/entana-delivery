import { describe, expect, it } from "vitest";
import { createOrderResponseSchema } from "./create-order-response.js";

const validResponse = {
  orderCode: "ABCDEF",
  status: "NEW",
  totalAr: 10000,
  deliveryFeeAr: 4000,
  createdAt: "2026-10-08T08:00:00.000Z",
};

describe("createOrderResponseSchema", () => {
  it("accepts a complete response", () => {
    expect(createOrderResponseSchema.parse(validResponse)).toEqual(validResponse);
  });

  it("refuses a response without the delivery fee", () => {
    const withoutFee = { ...validResponse, deliveryFeeAr: undefined };

    expect(createOrderResponseSchema.safeParse(withoutFee).success).toBe(false);
  });

  it.each(["trackingToken", "phone", "lat", "contactName", "customerId"])(
    "rejects an extra property %s (the response is strict)",
    (key) => {
      expect(createOrderResponseSchema.safeParse({ ...validResponse, [key]: "x" }).success).toBe(
        false,
      );
    },
  );

  it.each([
    ["an order code outside the alphabet", { orderCode: "ABCDE0" }],
    ["a status other than NEW", { status: "CONFIRMED" }],
    ["a fractional total", { totalAr: 10.5 }],
    ["a negative delivery fee", { deliveryFeeAr: -1 }],
    ["a date that is not ISO", { createdAt: "yesterday" }],
  ])("rejects %s", (_name, change) => {
    expect(createOrderResponseSchema.safeParse({ ...validResponse, ...change }).success).toBe(
      false,
    );
  });
});
