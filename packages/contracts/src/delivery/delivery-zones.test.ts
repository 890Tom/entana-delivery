import { describe, expect, it } from "vitest";
import { deliveryZoneListResponseSchema } from "./delivery-zones.js";

const ZONE = {
  id: "0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b",
  name: "Fake Market",
  latitude: -18.9,
  longitude: 47.5,
  radiusM: 500,
};

function isAccepted(value: unknown): boolean {
  return deliveryZoneListResponseSchema.safeParse(value).success;
}

describe("deliveryZoneListResponseSchema", () => {
  it("accepts an empty list", () => {
    expect(isAccepted({ zones: [] })).toBe(true);
  });

  it("accepts a zone with exactly the five public fields", () => {
    expect(isAccepted({ zones: [ZONE] })).toBe(true);
  });

  it("refuses a field of the axis", () => {
    expect(isAccepted({ zones: [{ ...ZONE, rank: 1 }] })).toBe(false);
  });

  it("refuses a zone that lacks a public field", () => {
    const incomplete: Record<string, unknown> = { ...ZONE };
    delete incomplete.radiusM;

    expect(isAccepted({ zones: [incomplete] })).toBe(false);
  });
});
