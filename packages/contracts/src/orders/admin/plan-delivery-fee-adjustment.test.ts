import { describe, expect, it } from "vitest";
import { MAX_AMOUNT_AR } from "../total/order-amount-limit.js";
import { planDeliveryFeeAdjustment } from "./plan-delivery-fee-adjustment.js";

const ORDER = {
  deliveryFeeAr: 3_000,
  lines: [
    { unitPrice: 5_000, quantity: 2 },
    { unitPrice: 1_500, quantity: 1 },
  ],
};

describe("planDeliveryFeeAdjustment", () => {
  it("changes nothing when no fee is given", () => {
    expect(planDeliveryFeeAdjustment(ORDER, undefined)).toEqual({ kind: "unchanged" });
  });

  it("changes nothing when the fee given is the recorded one", () => {
    expect(planDeliveryFeeAdjustment(ORDER, 3_000)).toEqual({ kind: "unchanged" });
  });

  it("sets the new fee and computes the total again from the frozen lines", () => {
    expect(planDeliveryFeeAdjustment(ORDER, 500)).toEqual({
      kind: "adjusted",
      fromAr: 3_000,
      toAr: 500,
      totalAr: 12_000,
    });
  });

  it("accepts a fee of 0", () => {
    expect(planDeliveryFeeAdjustment(ORDER, 0)).toMatchObject({
      kind: "adjusted",
      totalAr: 11_500,
    });
  });

  it("accepts a total at the column bound and refuses one above it", () => {
    const order = { deliveryFeeAr: 0, lines: [{ unitPrice: MAX_AMOUNT_AR - 1_000, quantity: 1 }] };

    expect(planDeliveryFeeAdjustment(order, 1_000)).toMatchObject({
      kind: "adjusted",
      totalAr: MAX_AMOUNT_AR,
    });
    expect(planDeliveryFeeAdjustment(order, 1_001)).toEqual({ kind: "too-large" });
  });
});
