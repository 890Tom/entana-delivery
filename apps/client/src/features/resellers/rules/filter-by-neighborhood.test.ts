import { describe, expect, it } from "vitest";

import { filterByNeighborhood } from "./filter-by-neighborhood";

const RESELLERS = [
  { neighborhood: "Isotry" },
  { neighborhood: "Analakely" },
  { neighborhood: "Andravoahangy" },
];

describe("filterByNeighborhood", () => {
  it("keeps every reseller, in order, when the text is blank", () => {
    expect(filterByNeighborhood(RESELLERS, "   ")).toEqual(RESELLERS);
  });

  it("matches a part of the neighborhood, ignoring case", () => {
    expect(filterByNeighborhood(RESELLERS, "ANDR")).toEqual([{ neighborhood: "Andravoahangy" }]);
  });

  it("ignores accents on both sides", () => {
    const accented = [{ neighborhood: "Ambohimanarina Été" }];

    expect(filterByNeighborhood(accented, "ete")).toEqual(accented);
    expect(filterByNeighborhood([{ neighborhood: "Ete" }], "Été")).toHaveLength(1);
  });

  it("gives nothing when no neighborhood matches", () => {
    expect(filterByNeighborhood(RESELLERS, "zzz")).toEqual([]);
  });
});
