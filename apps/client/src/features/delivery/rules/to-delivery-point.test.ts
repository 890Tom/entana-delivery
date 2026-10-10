import { describe, expect, it } from "vitest";

import { toDeliveryPoint } from "./to-delivery-point";

describe("toDeliveryPoint", () => {
  it("rounds both coordinates to 6 decimals", () => {
    expect(toDeliveryPoint(-18.9123456789, 47.5123454)).toEqual({
      lat: -18.912346,
      lng: 47.512345,
    });
  });

  it("accepts the edges of the contract", () => {
    expect(toDeliveryPoint(-90, 180)).toEqual({ lat: -90, lng: 180 });
  });

  it.each([
    ["a latitude above 90", 90.000001, 0],
    ["a latitude below -90", -90.000001, 0],
    ["a longitude above 180", 0, 180.000001],
    ["a longitude below -180", 0, -180.000001],
    ["a coordinate that is not a number", Number.NaN, 0],
  ])("refuses %s", (_name, lat, lng) => {
    expect(toDeliveryPoint(lat, lng)).toBeNull();
  });
});
