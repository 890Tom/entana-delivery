import { describe, expect, it } from "vitest";
import { toDeliveryZone } from "./to-delivery-zone.js";

describe("toDeliveryZone", () => {
  it("gives the contract names to the columns and keeps exactly five fields", () => {
    const row = {
      id: "0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b",
      name: "Fake Market",
      lat: -18.9,
      lng: 47.5,
      radiusM: 500,
    };

    expect(toDeliveryZone(row)).toStrictEqual({
      id: "0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b",
      name: "Fake Market",
      latitude: -18.9,
      longitude: 47.5,
      radiusM: 500,
    });
  });
});
