import { computeDistanceMeters } from "@entana/contracts";
import { describe, expect, it } from "vitest";

import { toCircleRing } from "./to-circle-ring";

const CENTER = { lat: -18.9, lng: 47.52 };

describe("toCircleRing", () => {
  it("puts every position of the ring at the radius from the centre, in metres", () => {
    const ring = toCircleRing(CENTER, 800);

    for (const [lng, lat] of ring) {
      expect(computeDistanceMeters(CENTER, { lat, lng })).toBeCloseTo(800, 3);
    }
  });

  it("closes the ring on its first position", () => {
    const ring = toCircleRing(CENTER, 800);

    expect(ring.length).toBeGreaterThan(3);
    expect(ring.at(-1)).toEqual(ring[0]);
  });
});
