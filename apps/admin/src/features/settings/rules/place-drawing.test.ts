import { describe, expect, it } from "vitest";

import {
  cancelDraft,
  draftAdded,
  draftOf,
  editDraft,
  IDLE_DRAWING,
  nextUndo,
  pickPoint,
  startCreating,
  startTracing,
} from "./place-drawing";

const POINT = { lat: -18.9, lng: 47.5 };
const OTHER_POINT = { lat: -18.8, lng: 47.6 };

describe("a click on the map", () => {
  it("opens a draft at the default radius in a mode, and nothing when no mode is on", () => {
    expect(draftOf(pickPoint(startCreating(), POINT, true))).toEqual({
      point: POINT,
      name: "",
      radiusText: "500",
      hasTried: false,
    });
    expect(pickPoint(IDLE_DRAWING, POINT, true)).toBe(IDLE_DRAWING);
  });

  it("is ignored while a draft is open, and when the axis is full", () => {
    const open = pickPoint(startTracing(), POINT, true);

    expect(draftOf(pickPoint(open, OTHER_POINT, true))?.point).toEqual(POINT);
    expect(draftOf(pickPoint(startTracing(), POINT, false))).toBeNull();
  });
});

describe("the end of a draft", () => {
  it("ends the creation, whether the place was added or not", () => {
    const open = pickPoint(startCreating(), POINT, true);

    expect(draftAdded(open, "new-1")).toEqual(IDLE_DRAWING);
    expect(cancelDraft(open)).toEqual(IDLE_DRAWING);
  });

  it("keeps the trace on and remembers the places it added", () => {
    const open = pickPoint(startTracing(), POINT, true);

    expect(draftAdded(open, "new-1")).toEqual({ mode: "trace", draft: null, traced: ["new-1"] });
    expect(cancelDraft(open)).toEqual(startTracing());
  });

  it("changes nothing when there is no draft to edit", () => {
    expect(editDraft(startTracing(), { name: "Gare" })).toEqual(startTracing());
  });
});

describe("« Annuler le dernier point »", () => {
  const traced = draftAdded(draftAdded(pickPoint(startTracing(), POINT, true), "new-1"), "new-2");

  it("removes the open draft first", () => {
    const open = pickPoint(traced, POINT, true);

    expect(nextUndo(open, new Set(["new-1", "new-2"]))).toEqual({ kind: "draft" });
  });

  it("removes the last place of the trace still in the axis", () => {
    expect(nextUndo(traced, new Set(["new-1"]))).toEqual({ kind: "place", placeId: "new-1" });
  });

  it("has nothing to remove outside a trace, or once its places are gone", () => {
    expect(nextUndo(traced, new Set())).toEqual({ kind: "none" });
    expect(nextUndo(startCreating(), new Set(["new-1"]))).toEqual({ kind: "none" });
  });
});
