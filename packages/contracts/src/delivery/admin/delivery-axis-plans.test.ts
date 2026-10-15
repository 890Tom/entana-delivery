import { describe, expect, it } from "vitest";
import { planAxisReorder, planAxisUpdate } from "./delivery-axis-plans.js";

const BEFORE = { name: "North", active: true, color: "#2f6b5a", placeIds: ["a", "b"] };

describe("planAxisUpdate", () => {
  it("is unchanged for the same content", () => {
    expect(planAxisUpdate(BEFORE, { ...BEFORE, placeIds: ["a", "b"] })).toEqual({
      kind: "unchanged",
    });
  });

  it("names the fields that change, in a fixed order", () => {
    const plan = planAxisUpdate(BEFORE, {
      name: "South",
      active: false,
      color: "#9a4a2a",
      placeIds: ["b", "a"],
    });

    expect(plan).toEqual({ kind: "changed", fields: ["name", "active", "color", "places"] });
  });

  it("sees a removed place as a change of the places", () => {
    expect(planAxisUpdate(BEFORE, { ...BEFORE, placeIds: ["a"] })).toEqual({
      kind: "changed",
      fields: ["places"],
    });
  });
});

describe("planAxisReorder", () => {
  const current = [
    { id: "A", rank: 1 },
    { id: "B", rank: 3 },
    { id: "C", rank: 7 },
  ];

  it("gives the ranks 1..n in the order received and lists the axes that move", () => {
    expect(planAxisReorder(current, ["c", "a", "b"])).toEqual({
      kind: "ordered",
      moves: [
        { id: "c", from: 7, to: 1 },
        { id: "a", from: 1, to: 2 },
      ],
    });
  });

  it("has no move when the order is the same", () => {
    expect(
      planAxisReorder(
        [
          { id: "a", rank: 1 },
          { id: "b", rank: 2 },
        ],
        ["a", "b"],
      ),
    ).toEqual({
      kind: "ordered",
      moves: [],
    });
  });

  it.each([
    ["an incomplete list", ["a", "b"]],
    ["a duplicate", ["a", "a", "b"]],
    ["an unknown id", ["a", "b", "x"]],
  ])("refuses %s", (_label, ids) => {
    expect(planAxisReorder(current, ids)).toEqual({ kind: "mismatch" });
  });
});
