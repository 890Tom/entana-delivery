import { describe, expect, it } from "vitest";

import { computeDistanceKm } from "./haversine-distance";

describe("computeDistanceKm", () => {
  it("gives the known distance between two cities", () => {
    const paris = { lat: 48.8566, lng: 2.3522 };
    const london = { lat: 51.5074, lng: -0.1278 };

    expect(computeDistanceKm(paris, london)).toBeCloseTo(343.6, 0);
  });

  it("is zero for the same point and the same both ways", () => {
    const first = { lat: -18.91, lng: 47.52 };
    const second = { lat: -18.88, lng: 47.5 };

    expect(computeDistanceKm(first, first)).toBe(0);
    expect(computeDistanceKm(first, second)).toBeCloseTo(computeDistanceKm(second, first), 9);
  });
});
