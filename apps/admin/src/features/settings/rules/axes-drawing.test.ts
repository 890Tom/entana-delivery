import { computeDistanceMeters } from "@entana/contracts";
import { describe, expect, it } from "vitest";

import { buildAxis, buildAxisPlace } from "../../../test-support/settings/build-axis";

import { boundsOf, circleRing, selectDrawnAxes, toShapes } from "./axes-drawing";

describe("the axes drawn on the map", () => {
  it("leaves out the inactive axes", () => {
    const drawn = selectDrawnAxes([buildAxis(1), buildAxis(2, { active: false })]);

    expect(drawn.map((axis) => axis.id)).toEqual([buildAxis(1).id]);
  });

  it("leaves out the inactive places of an active axis", () => {
    const kept = buildAxisPlace(1, { radiusM: 800 });
    const axis = buildAxis(1, { places: [kept, buildAxisPlace(2, { active: false })] });

    expect(selectDrawnAxes([axis])[0]?.places).toEqual([
      { lat: kept.latitude, lng: kept.longitude, radiusM: 800 },
    ]);
  });

  it("draws the axis of highest priority last, on top of the others", () => {
    const drawn = selectDrawnAxes([buildAxis(1), buildAxis(2), buildAxis(3)]);

    expect(drawn.map((axis) => axis.id)).toEqual([
      buildAxis(3).id,
      buildAxis(2).id,
      buildAxis(1).id,
    ]);
  });
});

describe("the circle of a place", () => {
  const center = { lat: -18.91, lng: 47.52 };

  it("puts every point of the ring at the radius from the centre", () => {
    const ring = circleRing(center, 1500);

    for (const [lng, lat] of ring) {
      expect(computeDistanceMeters(center, { lat, lng })).toBeCloseTo(1500, -1);
    }
  });

  it("closes the ring on its first point", () => {
    const ring = circleRing(center, 500, 8);

    expect(ring).toHaveLength(9);
    expect(ring.at(-1)).toEqual(ring[0]);
  });
});

describe("the shapes of the axes", () => {
  it("gives a circle per place and a line through the centres, in the axis colour", () => {
    const places = [buildAxisPlace(1), buildAxisPlace(2)].map((place) => ({
      lat: place.latitude,
      lng: place.longitude,
      radiusM: place.radiusM,
    }));

    const shapes = toShapes([{ id: "a", color: "#2d5b8c", places }]);

    expect(shapes.features.map((feature) => feature.geometry.type)).toEqual([
      "Polygon",
      "Polygon",
      "LineString",
    ]);
    expect(shapes.features.at(-1)?.geometry.coordinates).toEqual(
      places.map((place) => [place.lng, place.lat]),
    );
    expect(new Set(shapes.features.map((feature) => feature.properties.color))).toEqual(
      new Set(["#2d5b8c"]),
    );
  });

  it("draws no line for an axis of a single place", () => {
    const shapes = toShapes([
      { id: "a", color: "#2f6b5a", places: [{ lat: 1, lng: 2, radiusM: 100 }] },
    ]);

    expect(shapes.features.map((feature) => feature.geometry.type)).toEqual(["Polygon"]);
  });
});

describe("the first view of the map", () => {
  it("frames the centres of every drawn place", () => {
    const axes = [
      { id: "a", color: "#2f6b5a", places: [{ lat: -19, lng: 47.4, radiusM: 100 }] },
      { id: "b", color: "#9a4a2a", places: [{ lat: -18.8, lng: 47.6, radiusM: 100 }] },
    ];

    expect(boundsOf(axes)).toEqual({ west: 47.4, south: -19, east: 47.6, north: -18.8 });
  });

  it("is left to the shop's view when no place is drawn", () => {
    expect(boundsOf([{ id: "a", color: "#2f6b5a", places: [] }])).toBeNull();
  });
});
