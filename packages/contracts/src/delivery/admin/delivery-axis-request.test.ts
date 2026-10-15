import { describe, expect, it } from "vitest";
import {
  MAX_PLACES_PER_AXIS,
  reorderDeliveryAxesRequestSchema,
  saveDeliveryAxisRequestSchema,
} from "./delivery-axis-request.js";

const ID = "0192b8a0-0000-7000-8000-000000000001";
const OTHER_ID = "0192b8a0-0000-7000-8000-000000000002";
const NEW_PLACE = { name: "Fake place", latitude: -18.9, longitude: 47.5 };
const parse = (body: unknown) => saveDeliveryAxisRequestSchema.safeParse(body);
const withPlaces = (places: unknown) => ({
  name: "Fake axis",
  active: true,
  color: "#2f6b5a",
  places,
});

describe("saveDeliveryAxisRequestSchema", () => {
  it("accepts an existing place and a new one with or without radius", () => {
    const result = parse(
      withPlaces([{ placeId: ID }, NEW_PLACE, { ...NEW_PLACE, name: "Other", radiusM: 800 }]),
    );

    expect(result.success).toBe(true);
  });

  it("trims the names", () => {
    const result = saveDeliveryAxisRequestSchema.parse({
      name: "  Fake axis  ",
      active: false,
      color: "#2f6b5a",
      places: [{ ...NEW_PLACE, name: " Fake place " }],
    });

    expect(result.name).toBe("Fake axis");
    expect(result.places[0]).toMatchObject({ name: "Fake place" });
  });

  it.each([
    ["an empty list of places", withPlaces([])],
    [
      "more places than the limit",
      withPlaces(Array.from({ length: MAX_PLACES_PER_AXIS + 1 }, () => NEW_PLACE)),
    ],
    [
      "the same placeId twice, in any case",
      withPlaces([{ placeId: ID }, { placeId: ID.toUpperCase() }]),
    ],
    ["an empty axis name", { ...withPlaces([{ placeId: ID }]), name: "  " }],
    ["an axis name over 60 characters", { ...withPlaces([{ placeId: ID }]), name: "x".repeat(61) }],
    ["a missing colour", { name: "Fake axis", active: true, places: [{ placeId: ID }] }],
    ["a colour in upper case", { ...withPlaces([{ placeId: ID }]), color: "#2F6B5A" }],
    ["a short colour", { ...withPlaces([{ placeId: ID }]), color: "#abc" }],
    ["a colour name", { ...withPlaces([{ placeId: ID }]), color: "red" }],
    ["a radius under the bound", withPlaces([{ ...NEW_PLACE, radiusM: 99 }])],
    ["a latitude out of range", withPlaces([{ ...NEW_PLACE, latitude: 91 }])],
    ["an entry that is both an id and a new place", withPlaces([{ placeId: ID, ...NEW_PLACE }])],
  ])("refuses %s", (_label, body) => {
    expect(parse(body).success).toBe(false);
  });

  it("accepts the limit of places", () => {
    const places = Array.from({ length: MAX_PLACES_PER_AXIS }, (_, index) => ({
      ...NEW_PLACE,
      name: `Place ${String(index)}`,
    }));

    expect(parse(withPlaces(places)).success).toBe(true);
  });
});

describe("reorderDeliveryAxesRequestSchema", () => {
  it("accepts a list of ids and refuses anything else", () => {
    expect(reorderDeliveryAxesRequestSchema.safeParse({ ids: [ID, OTHER_ID] }).success).toBe(true);
    expect(reorderDeliveryAxesRequestSchema.safeParse({ ids: ["x"] }).success).toBe(false);
  });
});
