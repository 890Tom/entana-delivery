import { describe, expect, it } from "vitest";
import { computeDistanceMeters } from "./haversine-distance.js";
import type { GeoPoint } from "./haversine-distance.js";
import { resolveDeliveryAxis } from "./resolve-delivery-axis.js";
import type { DeliveryAxis, DeliveryPlace } from "./resolve-delivery-axis.js";

const ORIGIN: GeoPoint = { lat: 0, lng: 0 };
// The Earth radius of the haversine formula, so that a distance in metres converts exactly.
const METERS_PER_DEGREE = (6_371_000 * Math.PI) / 180;

function pointEastOfOrigin(meters: number): GeoPoint {
  return { lat: 0, lng: meters / METERS_PER_DEGREE };
}

function buildPlace(overrides: Partial<DeliveryPlace> = {}): DeliveryPlace {
  return { id: "place-a", lat: 0, lng: 0, radiusM: 500, active: true, ...overrides };
}

function buildAxis(overrides: Partial<DeliveryAxis> = {}): DeliveryAxis {
  return { id: "axis-a", rank: 1, active: true, places: [buildPlace()], ...overrides };
}

describe("resolveDeliveryAxis", () => {
  it("returns null for a point outside every place", () => {
    expect(resolveDeliveryAxis(pointEastOfOrigin(2_000), [buildAxis()])).toBeNull();
  });

  it("returns the axis and the place that cover the point", () => {
    const axis = buildAxis();

    const match = resolveDeliveryAxis(pointEastOfOrigin(100), [axis]);

    expect(match?.axis.id).toBe("axis-a");
    expect(match?.place.id).toBe("place-a");
  });

  it("prefers the axis of the lowest rank when two axes cover the point", () => {
    const lowerPriority = buildAxis({ id: "axis-b", rank: 2 });
    const higherPriority = buildAxis({ id: "axis-a", rank: 1 });

    const match = resolveDeliveryAxis(ORIGIN, [lowerPriority, higherPriority]);

    expect(match?.axis.id).toBe("axis-a");
  });

  it("ignores an inactive axis", () => {
    const inactive = buildAxis({ id: "axis-a", rank: 1, active: false });
    const active = buildAxis({ id: "axis-b", rank: 2 });

    const match = resolveDeliveryAxis(ORIGIN, [inactive, active]);

    expect(match?.axis.id).toBe("axis-b");
  });

  it("does not let an inactive place cover the point", () => {
    const axis = buildAxis({ places: [buildPlace({ active: false })] });

    expect(resolveDeliveryAxis(ORIGIN, [axis])).toBeNull();
  });

  it("covers a point whose distance equals the radius", () => {
    // Searches the whole metres for a point that the haversine formula puts at exactly that
    // distance, so the boundary is tested without a tolerance.
    const exact = Array.from({ length: 2_901 }, (_, index) => index + 100)
      .map((meters) => ({ meters, point: pointEastOfOrigin(meters) }))
      .find(({ meters, point }) => computeDistanceMeters(ORIGIN, point) === meters);
    if (exact === undefined) throw new Error("No point at an exact whole distance was found.");
    const axis = buildAxis({ places: [buildPlace({ radiusM: exact.meters })] });

    expect(resolveDeliveryAxis(exact.point, [axis])).not.toBeNull();
  });

  it("does not cover a point just beyond the radius", () => {
    const axis = buildAxis({ places: [buildPlace({ radiusM: 500 })] });

    expect(resolveDeliveryAxis(pointEastOfOrigin(501), [axis])).toBeNull();
  });

  it("returns the closest place when several places of the winning axis cover the point", () => {
    const far = buildPlace({ id: "place-far", lng: 400 / METERS_PER_DEGREE });
    const near = buildPlace({ id: "place-near", lng: 50 / METERS_PER_DEGREE });
    const axis = buildAxis({ places: [far, near] });

    const match = resolveDeliveryAxis(ORIGIN, [axis]);

    expect(match?.place.id).toBe("place-near");
  });

  it("breaks a tie between equally close places by identifier", () => {
    const second = buildPlace({ id: "place-b" });
    const first = buildPlace({ id: "place-a" });
    const axis = buildAxis({ places: [second, first] });

    const match = resolveDeliveryAxis(ORIGIN, [axis]);

    expect(match?.place.id).toBe("place-a");
  });

  it("does not reorder the axes it receives", () => {
    const axes = [buildAxis({ id: "axis-b", rank: 2 }), buildAxis({ id: "axis-a", rank: 1 })];

    resolveDeliveryAxis(ORIGIN, axes);

    expect(axes.map((axis) => axis.id)).toEqual(["axis-b", "axis-a"]);
  });
});
