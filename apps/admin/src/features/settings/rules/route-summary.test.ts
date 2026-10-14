import { describe, expect, it } from "vitest";

import { summarizeRoute } from "./route-summary";

describe("the summary of a route", () => {
  it("is the name of the place when the axis has one", () => {
    expect(summarizeRoute(["Gare"])).toBe("Gare");
  });

  it("names both places of a route of two", () => {
    expect(summarizeRoute(["Gare", "Marché"])).toBe("Gare → Marché");
  });

  it("names the three places of a route of three", () => {
    expect(summarizeRoute(["Gare", "Marché", "Stade"])).toBe("Gare → Marché → Stade");
  });

  it("names the first two and the last of a longer route", () => {
    const route = ["Gare", "Marché", "Stade", "Lycée", "Poste", "Église", "Port"];

    expect(summarizeRoute(route)).toBe("Gare → Marché → … → Port");
  });
});
