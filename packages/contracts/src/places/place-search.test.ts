import { describe, expect, it } from "vitest";
import { placeSearchQuerySchema, placeSearchResponseSchema } from "./place-search.js";

const SUGGESTION = { label: "Fake Station, Fake Street, Fake City", lat: -18.9, lng: 47.5 };

describe("placeSearchQuerySchema", () => {
  it("trims the text", () => {
    expect(placeSearchQuerySchema.parse({ q: "  gare  " })).toEqual({ q: "gare" });
  });

  it.each([
    ["2 characters after trimming", { q: "  ab  " }],
    ["101 characters", { q: "a".repeat(101) }],
    ["a missing text", {}],
    ["an unknown parameter", { q: "gare", lat: "-18.9" }],
  ])("refuses %s", (_name, query) => {
    expect(placeSearchQuerySchema.safeParse(query).success).toBe(false);
  });

  it("accepts 3 and 100 characters", () => {
    expect(placeSearchQuerySchema.safeParse({ q: "abc" }).success).toBe(true);
    expect(placeSearchQuerySchema.safeParse({ q: "a".repeat(100) }).success).toBe(true);
  });
});

describe("placeSearchResponseSchema", () => {
  it("accepts an empty list", () => {
    expect(placeSearchResponseSchema.safeParse({ suggestions: [] }).success).toBe(true);
  });

  it("refuses a sixth suggestion", () => {
    const suggestions = Array.from({ length: 6 }, () => SUGGESTION);

    expect(placeSearchResponseSchema.safeParse({ suggestions }).success).toBe(false);
  });

  it("refuses a field beyond label, lat and lng", () => {
    const suggestions = [{ ...SUGGESTION, countrycode: "MG" }];

    expect(placeSearchResponseSchema.safeParse({ suggestions }).success).toBe(false);
  });

  it("refuses an empty label", () => {
    const suggestions = [{ ...SUGGESTION, label: "" }];

    expect(placeSearchResponseSchema.safeParse({ suggestions }).success).toBe(false);
  });
});
