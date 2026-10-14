import { describe, expect, it } from "vitest";

import { buildAxis, buildAxisPlace, buildPlace } from "../../../test-support/settings/build-axis";

import { newAxisForm } from "./axis-form";
import { knownPlaceNames, shownRadius, validateNewPlace } from "./new-place";

const TAKEN = new Set(["gare"]);
const valid = { name: "Ivandry", radiusText: "500" };

describe("the check of a new place", () => {
  it("accepts a free name of 1 to 60 characters and a radius within the bounds", () => {
    expect(validateNewPlace({ name: "x".repeat(60), radiusText: "3000" }, TAKEN)).toEqual({});
    expect(validateNewPlace({ name: " Y ", radiusText: "100" }, TAKEN)).toEqual({});
  });

  it.each([
    ["an empty name", "  ", "empty"],
    ["a name over 60 characters", "x".repeat(61), "tooLong"],
    ["a name taken in another case", " GARE ", "taken"],
  ])("refuses %s", (_label, name, error) => {
    expect(validateNewPlace({ ...valid, name }, TAKEN)).toEqual({ name: error });
  });

  it.each(["99", "3001", "", "500.5", "-200"])("refuses the radius « %s »", (radiusText) => {
    expect(validateNewPlace({ ...valid, radiusText }, TAKEN)).toEqual({ radius: "outOfRange" });
  });
});

describe("the radius shown by the slider and the circle", () => {
  it.each([
    ["750", 750],
    ["20", 100],
    ["9000", 3000],
    ["abc", 500],
  ])("is %s → %i", (text, radius) => {
    expect(shownRadius(text)).toBe(radius);
  });
});

describe("the names already taken", () => {
  it("gathers the active places, the places of every axis and the places being added", () => {
    const inactive = buildAxisPlace(3, { name: "Usine", active: false });
    const values = {
      ...newAxisForm("#123456"),
      places: [
        {
          kind: "new" as const,
          id: "new-1",
          name: " Ivandry ",
          latitude: -18.9,
          longitude: 47.5,
          radiusM: 500,
        },
      ],
    };

    const names = knownPlaceNames(
      [buildPlace(1, { name: "Gare" })],
      [buildAxis(1, { places: [inactive] })],
      values,
    );

    expect([...names].sort()).toEqual(["gare", "ivandry", "usine"]);
  });
});
