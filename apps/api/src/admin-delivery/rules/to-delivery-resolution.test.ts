import { describe, expect, it } from "vitest";
import { resolveAddress } from "./to-delivery-resolution.js";
import type { StoredAxis } from "./to-admin-delivery.js";

const SETTINGS = { outOfAxisFeeAr: 4000, freeDeliveryMinPieces: 20, outOfAxisMessage: "m" };
const AXES: StoredAxis[] = [
  {
    id: "axis-1",
    name: "North",
    rank: 1,
    colorKey: 3,
    active: true,
    places: [
      {
        position: 1,
        place: { id: "place-1", name: "Market", lat: -18.9, lng: 47.5, radiusM: 500, active: true },
      },
    ],
  },
];

describe("resolveAddress", () => {
  it("names the axis and the place of the match, and the delivery is free", () => {
    const answer = resolveAddress({ lat: -18.9, lng: 47.5 }, 1, AXES, SETTINGS);

    expect(answer).toEqual({
      match: {
        axis: { id: "axis-1", name: "North", colorKey: 3 },
        place: { id: "place-1", name: "Market" },
      },
      feeAr: 0,
      reason: "axis",
    });
  });

  it("charges the out-of-axis fee away from every place", () => {
    const answer = resolveAddress({ lat: 0, lng: 0 }, 1, AXES, SETTINGS);

    expect(answer).toEqual({ match: null, feeAr: 4000, reason: "out_of_axis" });
  });

  it("is free at the piece threshold, away from every place", () => {
    const answer = resolveAddress({ lat: 0, lng: 0 }, 20, AXES, SETTINGS);

    expect(answer).toEqual({ match: null, feeAr: 0, reason: "quantity" });
  });
});
