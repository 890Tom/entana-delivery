import { describe, expect, it } from "vitest";

import { buildReseller } from "../../../test-support/resellers/build-reseller";

import {
  buildCreateBody,
  buildUpdateBody,
  coordinateText,
  emptyResellerForm,
  formValuesOf,
  parseCoordinate,
  pointOf,
  validateResellerForm,
} from "./reseller-form";

const valid = {
  ...emptyResellerForm(),
  name: "Épicerie Soa",
  neighborhood: "Analakely",
  landmark: "Face à la pharmacie",
  latitude: "-18,9097",
  longitude: "47.5236",
};

describe("the validation of the reseller form", () => {
  it("accepts a form with the seven fields, a comma or a point in the coordinates", () => {
    expect(validateResellerForm(valid)).toEqual({});
  });

  it.each(["name", "neighborhood", "landmark", "latitude", "longitude"] as const)(
    "refuses an empty %s",
    (field) => {
      expect(validateResellerForm({ ...valid, [field]: "  " })).toEqual({ [field]: true });
    },
  );

  it("refuses a coordinate that is not a number or out of range", () => {
    expect(validateResellerForm({ ...valid, latitude: "91" })).toEqual({ latitude: true });
    expect(validateResellerForm({ ...valid, longitude: "abc" })).toEqual({ longitude: true });
  });
});

describe("the coordinates", () => {
  it("reads a decimal comma and rejects an empty text", () => {
    expect(parseCoordinate(" -18,5 ")).toBe(-18.5);
    expect(parseCoordinate("")).toBeNull();
  });

  it("gives no point until both coordinates are valid", () => {
    expect(pointOf({ ...valid, longitude: "" })).toBeNull();
    expect(pointOf(valid)).toEqual({ lat: -18.9097, lng: 47.5236 });
  });

  it("writes a coordinate with a point and at most six decimals", () => {
    expect(coordinateText(-18.90970001234)).toBe("-18.9097");
  });
});

describe("the bodies of the requests", () => {
  it("builds a creation with the seven fields", () => {
    expect(buildCreateBody(valid)).toEqual({
      name: "Épicerie Soa",
      neighborhood: "Analakely",
      landmark: "Face à la pharmacie",
      latitude: -18.9097,
      longitude: 47.5236,
      consentGiven: false,
      visible: false,
    });
  });

  it("sends the two coordinates together as soon as one changed, and only what changed", () => {
    const reseller = buildReseller(1);
    const values = { ...formValuesOf(reseller), latitude: "-18.5" };

    expect(buildUpdateBody(reseller, values)).toEqual({
      latitude: -18.5,
      longitude: reseller.longitude,
    });
  });

  it("builds nothing from a form whose position is not valid", () => {
    const reseller = buildReseller(1);
    const broken = { ...valid, latitude: "" };

    expect(buildCreateBody(broken)).toBeNull();
    expect(buildUpdateBody(reseller, { ...formValuesOf(reseller), longitude: "x" })).toBeNull();
  });

  it("has nothing to send when nothing changed", () => {
    const reseller = buildReseller(1);

    expect(buildUpdateBody(reseller, formValuesOf(reseller))).toBeNull();
  });
});
