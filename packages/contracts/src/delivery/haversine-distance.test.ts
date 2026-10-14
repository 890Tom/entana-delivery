import { describe, expect, it } from "vitest";
import { computeDistanceMeters } from "./haversine-distance.js";

describe("computeDistanceMeters", () => {
  it("is zero between a point and itself", () => {
    expect(computeDistanceMeters({ lat: -18.9, lng: 47.5 }, { lat: -18.9, lng: 47.5 })).toBe(0);
  });

  it("measures one degree of latitude as about 111 km", () => {
    const distance = computeDistanceMeters({ lat: 0, lng: 0 }, { lat: 1, lng: 0 });
    expect(distance).toBeGreaterThan(111_000);
    expect(distance).toBeLessThan(111_400);
  });

  it("is the same in both directions", () => {
    const antananarivo = { lat: -18.8792, lng: 47.5079 };
    const toamasina = { lat: -18.1443, lng: 49.3958 };
    expect(computeDistanceMeters(antananarivo, toamasina)).toBe(
      computeDistanceMeters(toamasina, antananarivo),
    );
  });
});
