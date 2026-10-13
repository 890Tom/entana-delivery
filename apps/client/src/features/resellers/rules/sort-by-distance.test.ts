import type { PublicReseller } from "@entana/contracts";
import { describe, expect, it } from "vitest";

import { toShopEntries } from "./sort-by-distance";

function build(name: string, latitude: number): PublicReseller {
  return {
    id: "0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b",
    name,
    neighborhood: "Demo Area",
    landmark: "Fake landmark",
    latitude,
    longitude: 47.5,
  };
}

const FAR = build("Far", -19.5);
const NEAR = build("Near", -18.91);
const MIDDLE = build("Middle", -19.0);
const HERE = { lat: -18.9, lng: 47.5 };

describe("toShopEntries", () => {
  it("keeps the order of the API and gives no distance without a position", () => {
    const entries = toShopEntries([FAR, NEAR, MIDDLE], null);

    expect(entries.map((entry) => entry.reseller.name)).toEqual(["Far", "Near", "Middle"]);
    expect(entries.map((entry) => entry.distanceKm)).toEqual([null, null, null]);
  });

  it("sorts from the nearest to the farthest with a position", () => {
    const entries = toShopEntries([FAR, NEAR, MIDDLE], HERE);

    expect(entries.map((entry) => entry.reseller.name)).toEqual(["Near", "Middle", "Far"]);
    expect(entries[0]?.distanceKm).toBeCloseTo(1.1, 1);
  });

  it("does not change the list it receives", () => {
    const resellers = [FAR, NEAR];

    toShopEntries(resellers, HERE);

    expect(resellers).toEqual([FAR, NEAR]);
  });
});
