import { describe, expect, it } from "vitest";

import { buildAxisPlace, buildPlace } from "../../../test-support/settings/build-axis";

import { toAxisDrawing, toOtherZones } from "./axis-editor-drawing";
import { newAxisForm } from "./axis-form";

const first = { ...buildAxisPlace(1, { name: "Gare", radiusM: 400 }), kind: "existing" as const };
const second = {
  ...buildAxisPlace(2, { name: "Marché", radiusM: 900 }),
  kind: "existing" as const,
};
const elsewhere = buildAxisPlace(3, { radiusM: 300 });
const listed = [buildPlace(1, { name: "Gare", radiusM: 400 }), buildPlace(3, { radiusM: 300 })];

describe("the drawing of the axis being edited", () => {
  it("draws its places in order, in its colour, and the other active places apart", () => {
    const values = { ...newAxisForm("#123456"), places: [second, first] };
    const pending = { lat: -18.7, lng: 47.7, radiusM: 650 };

    expect(toAxisDrawing(values, listed, pending)).toEqual({
      color: "#123456",
      places: [
        { name: "Marché", lat: second.latitude, lng: second.longitude, radiusM: 900 },
        { name: "Gare", lat: first.latitude, lng: first.longitude, radiusM: 400 },
      ],
      others: [{ lat: elsewhere.latitude, lng: elsewhere.longitude, radiusM: 300 }],
      pending,
    });
  });

  it("outlines the other places as circles, without a line between them", () => {
    const zones = toOtherZones([
      { lat: -18.9, lng: 47.5, radiusM: 300 },
      { lat: -18.8, lng: 47.6, radiusM: 300 },
    ]);

    expect(zones.features.map((feature) => feature.geometry.type)).toEqual(["Polygon", "Polygon"]);
  });
});
