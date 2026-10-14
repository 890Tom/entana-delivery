import { describe, expect, it } from "vitest";
import { computeDeliveryFee } from "./compute-delivery-fee.js";
import type { DeliveryFeeInput } from "./compute-delivery-fee.js";
import type { DeliveryMatch } from "./resolve-delivery-axis.js";

const place = { id: "place-a", lat: 0, lng: 0, radiusM: 500, active: true };
const MATCH: DeliveryMatch = {
  axis: { id: "axis-a", rank: 1, active: true, places: [place] },
  place,
};

function buildInput(overrides: Partial<DeliveryFeeInput> = {}): DeliveryFeeInput {
  return {
    match: null,
    totalPieces: 1,
    outOfAxisFeeAr: 4000,
    freeDeliveryMinPieces: 20,
    ...overrides,
  };
}

describe("computeDeliveryFee", () => {
  it("is free inside an axis", () => {
    expect(computeDeliveryFee(buildInput({ match: MATCH }))).toEqual({ feeAr: 0, reason: "axis" });
  });

  it("is free outside an axis from the piece threshold", () => {
    expect(computeDeliveryFee(buildInput({ totalPieces: 20 }))).toEqual({
      feeAr: 0,
      reason: "quantity",
    });
  });

  it("charges the out-of-axis fee one piece below the threshold", () => {
    expect(computeDeliveryFee(buildInput({ totalPieces: 19, outOfAxisFeeAr: 4500 }))).toEqual({
      feeAr: 4500,
      reason: "out_of_axis",
    });
  });

  it("reports the axis, not the quantity, when both make the delivery free", () => {
    expect(computeDeliveryFee(buildInput({ match: MATCH, totalPieces: 50 })).reason).toBe("axis");
  });
});
