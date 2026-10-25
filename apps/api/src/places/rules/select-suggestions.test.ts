import { describe, expect, it } from "vitest";
import { selectSuggestions } from "./select-suggestions.js";
import type { PlaceCandidate } from "./select-suggestions.js";

function candidate(label: string, countryCode: string | undefined): PlaceCandidate {
  return { label, lat: -18.9, lng: 47.5, countryCode };
}

// About 50 km south of Antananarivo: no distance filter may drop it.
const AMBATOLAMPY: PlaceCandidate = {
  label: "Ambatolampy",
  lat: -19.3806567,
  lng: 47.4398136,
  countryCode: "MG",
};

function malagasy(label: string): PlaceCandidate {
  return candidate(label, "MG");
}

describe("selectSuggestions", () => {
  it("keeps only the places of Madagascar, near or far, in the order of the provider", () => {
    const candidates = [
      malagasy("A"),
      candidate("Foreign", "FR"),
      AMBATOLAMPY,
      candidate("Unknown country", undefined),
      malagasy("B"),
    ];

    expect(selectSuggestions(candidates).map((suggestion) => suggestion.label)).toEqual([
      "A",
      "Ambatolampy",
      "B",
    ]);
  });

  it("keeps the first 5 places", () => {
    const candidates = ["A", "B", "C", "D", "E", "F"].map((label) => malagasy(label));

    expect(selectSuggestions(candidates).map((suggestion) => suggestion.label)).toEqual([
      "A",
      "B",
      "C",
      "D",
      "E",
    ]);
  });

  it("returns only the label and the point", () => {
    expect(selectSuggestions([malagasy("A")])).toStrictEqual([
      { label: "A", lat: -18.9, lng: 47.5 },
    ]);
  });
});
