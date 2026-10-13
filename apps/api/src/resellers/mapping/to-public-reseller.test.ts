import { describe, expect, it } from "vitest";
import { toPublicReseller } from "./to-public-reseller.js";

describe("toPublicReseller", () => {
  it("gives the contract names to the columns and keeps exactly six fields", () => {
    const row = {
      id: "0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b",
      name: "Demo Reseller",
      area: "Demo Area",
      landmarkText: "Next to the fake market",
      lat: -18.9,
      lng: 47.5,
    };

    expect(toPublicReseller(row)).toStrictEqual({
      id: "0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b",
      name: "Demo Reseller",
      neighborhood: "Demo Area",
      landmark: "Next to the fake market",
      latitude: -18.9,
      longitude: 47.5,
    });
  });
});
