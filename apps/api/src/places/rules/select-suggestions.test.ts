import { describe, expect, it } from "vitest";
import { selectSuggestions } from "./select-suggestions.js";
import type { PlaceCandidate } from "./select-suggestions.js";

function candidate(label: string, countryCode: string | undefined): PlaceCandidate {
  return { label, lat: -18.9, lng: 47.5, countryCode };
}

function malagasy(label: string): PlaceCandidate {
  return candidate(label, "MG");
}

describe("selectSuggestions", () => {
  it("keeps only the places of Madagascar, in the order of the provider", () => {
    const candidates = [
      malagasy("A"),
      candidate("Foreign", "FR"),
      candidate("Unknown country", undefined),
      malagasy("B"),
    ];

    expect(selectSuggestions(candidates).map((suggestion) => suggestion.label)).toEqual(["A", "B"]);
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
