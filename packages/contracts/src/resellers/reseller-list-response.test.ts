import { describe, expect, it } from "vitest";
import { resellerListResponseSchema } from "./reseller-list-response.js";

const RESELLER = {
  id: "0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b",
  name: "Demo Reseller",
  neighborhood: "Demo Area",
  landmark: "Next to the fake market",
  latitude: -18.9,
  longitude: 47.5,
};

function isAccepted(value: unknown): boolean {
  return resellerListResponseSchema.safeParse(value).success;
}

describe("resellerListResponseSchema", () => {
  it("accepts an empty list", () => {
    expect(isAccepted({ resellers: [] })).toBe(true);
  });

  it("accepts a reseller with exactly the six public fields", () => {
    expect(isAccepted({ resellers: [RESELLER] })).toBe(true);
  });

  it.each(["consentGiven", "visible", "verifiedAt"])("refuses the internal field %s", (field) => {
    expect(isAccepted({ resellers: [{ ...RESELLER, [field]: true }] })).toBe(false);
  });

  it("refuses a reseller that lacks a public field", () => {
    const incomplete: Record<string, unknown> = { ...RESELLER };
    delete incomplete.landmark;

    expect(isAccepted({ resellers: [incomplete] })).toBe(false);
  });

  it("refuses a bare array instead of the object", () => {
    expect(isAccepted([RESELLER])).toBe(false);
  });
});
