import { MAX_PLACES_PER_AXIS } from "@entana/contracts";
import type { AdminDeliveryPlace } from "@entana/contracts";
import { describe, expect, it } from "vitest";

import { buildAxis, buildAxisPlace, buildPlace } from "../../../test-support/settings/build-axis";

import {
  canAddPlace,
  formValuesOfAxis,
  isAxisFormChanged,
  isAxisFormValid,
  newAxisForm,
  otherAxesOf,
  PLACE_SEARCH_LIMIT,
  searchPlaces,
  toSaveAxisRequest,
  validateAxisForm,
} from "./axis-form";

const placeOf = (index: number, name = `Lieu ${String(index)}`): AdminDeliveryPlace =>
  buildPlace(index, { name });

const axis = buildAxis(1, {
  name: "Axe Nord",
  color: "#2f6b5a",
  places: [buildAxisPlace(1), buildAxisPlace(2)],
});
const saved = formValuesOfAxis(axis);

describe("the validation of the axis form", () => {
  it("accepts a name and one place", () => {
    expect(validateAxisForm(saved)).toEqual({});
    expect(isAxisFormValid(saved)).toBe(true);
  });

  it("refuses a name made of spaces and an axis without a place", () => {
    const empty = { ...newAxisForm("#2f6b5a"), name: "   " };

    expect(validateAxisForm(empty)).toEqual({ name: "empty", places: "empty" });
    expect(isAxisFormValid(empty)).toBe(false);
  });
});

describe("the changes of the axis form", () => {
  it("sees no change in the saved axis, nor in spaces around its name", () => {
    expect(isAxisFormChanged(saved, { ...saved, name: " Axe Nord " })).toBe(false);
  });

  it.each([
    ["the name", { name: "Axe Sud" }],
    ["the colour", { color: "#9a4a2a" }],
    ["the state", { active: false }],
    ["the order of the places", { places: [...saved.places].reverse() }],
  ])("sees a change of %s", (_what, change) => {
    expect(isAxisFormChanged(saved, { ...saved, ...change })).toBe(true);
  });
});

describe("the body of the save", () => {
  it("sends the trimmed name, the colour, the state and the places by id, in order", () => {
    const values = { ...saved, name: "  Axe Nord ", places: [...saved.places].reverse() };

    expect(toSaveAxisRequest(values)).toEqual({
      name: "Axe Nord",
      color: "#2f6b5a",
      active: true,
      places: [{ placeId: buildAxisPlace(2).id }, { placeId: buildAxisPlace(1).id }],
    });
  });
});

describe("the place search", () => {
  const places = [placeOf(5, "Ambohibao"), placeOf(6, "Ampefiloha"), placeOf(7, "Isotry")];

  it("finds a place without regard to case or accents, outside the axis", () => {
    expect(searchPlaces(places, "AMBÔ", saved).map((place) => place.name)).toEqual(["Ambohibao"]);
  });

  it("leaves out the places already in the axis", () => {
    const values = { ...saved, places: [placeOf(5, "Ambohibao")] };

    expect(searchPlaces(places, "am", values).map((place) => place.name)).toEqual(["Ampefiloha"]);
  });

  it("shows nothing before a search", () => {
    expect(searchPlaces(places, "  ", saved)).toEqual([]);
  });

  it("shows a few results at most", () => {
    const many = Array.from({ length: 12 }, (_, index) => placeOf(10 + index));

    expect(searchPlaces(many, "lieu", saved)).toHaveLength(PLACE_SEARCH_LIMIT);
  });
});

describe("the limit of places", () => {
  it("lets a place be added below the limit, not at it", () => {
    const full = Array.from({ length: MAX_PLACES_PER_AXIS }, (_, index) => placeOf(index));

    expect(canAddPlace(saved)).toBe(true);
    expect(canAddPlace({ ...saved, places: full })).toBe(false);
  });
});

describe("the other axes of a place", () => {
  it("names the other axes that hold the place, in priority order, not the axis itself", () => {
    const shared = buildAxisPlace(1);
    const axes = [
      axis,
      buildAxis(2, { name: "Axe Est", places: [shared] }),
      buildAxis(3, { name: "Axe Sud", places: [buildAxisPlace(5)] }),
      buildAxis(4, { name: "Axe Ouest", places: [shared] }),
    ];

    expect(otherAxesOf(axes, shared.id, axis.id)).toEqual(["Axe Est", "Axe Ouest"]);
    expect(otherAxesOf(axes, shared.id, null)).toEqual(["Axe Nord", "Axe Est", "Axe Ouest"]);
  });
});
