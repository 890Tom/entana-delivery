import { describe, expect, it } from "vitest";
import { isRowSelectable, nextStatus, pruneSelection, selectAllRows, toggleRow } from "./selection";

const confirmed = { id: "a", status: "CONFIRMED" } as const;
const confirmedToo = { id: "b", status: "CONFIRMED" } as const;
const onTheRoad = { id: "c", status: "OUT_FOR_DELIVERY" } as const;
const delivered = { id: "d", status: "DELIVERED" } as const;

describe("nextStatus", () => {
  it("moves a confirmed order to the road and an order on the road to delivered", () => {
    expect(nextStatus("CONFIRMED")).toBe("OUT_FOR_DELIVERY");
    expect(nextStatus("OUT_FOR_DELIVERY")).toBe("DELIVERED");
  });

  it.each(["NEW", "DELIVERED", "REJECTED", "CANCELLED", "FAILED"] as const)(
    "has no step after %s",
    (status) => {
      expect(nextStatus(status)).toBeNull();
    },
  );
});

describe("isRowSelectable", () => {
  it("allows a row with a next step when nothing is selected", () => {
    expect(isRowSelectable(confirmed, null)).toBe(true);
    expect(isRowSelectable(onTheRoad, null)).toBe(true);
    expect(isRowSelectable(delivered, null)).toBe(false);
  });

  it("allows only the status already selected", () => {
    const selection = { status: "CONFIRMED", ids: ["a"] } as const;

    expect(isRowSelectable(confirmedToo, selection)).toBe(true);
    expect(isRowSelectable(onTheRoad, selection)).toBe(false);
  });
});

describe("toggleRow", () => {
  it("adds a row, removes it, and is empty again when the last one leaves", () => {
    const one = toggleRow(null, confirmed);
    const two = toggleRow(one, confirmedToo);
    const back = toggleRow(two, confirmed);

    expect(one).toEqual({ status: "CONFIRMED", ids: ["a"] });
    expect(two).toEqual({ status: "CONFIRMED", ids: ["a", "b"] });
    expect(back).toEqual({ status: "CONFIRMED", ids: ["b"] });
    expect(toggleRow(back, confirmedToo)).toBeNull();
  });
});

describe("selectAllRows", () => {
  it("takes every row of the status of the first one, in the order of the table", () => {
    expect(selectAllRows([confirmed, confirmedToo])).toEqual({
      status: "CONFIRMED",
      ids: ["a", "b"],
    });
  });

  it("selects nothing in a list without a next step", () => {
    expect(selectAllRows([delivered])).toBeNull();
    expect(selectAllRows([])).toBeNull();
  });
});

describe("pruneSelection", () => {
  it("drops the ids that are gone or whose status changed", () => {
    const selection = { status: "CONFIRMED", ids: ["a", "b", "z"] } as const;
    const rows = [confirmed, { id: "b", status: "OUT_FOR_DELIVERY" } as const];

    expect(pruneSelection(selection, rows)).toEqual({ status: "CONFIRMED", ids: ["a"] });
  });

  it("is empty when no id is left, and unchanged when none left", () => {
    const selection = { status: "CONFIRMED", ids: ["a"] } as const;

    expect(pruneSelection(selection, [delivered])).toBeNull();
    expect(pruneSelection(selection, [confirmed])).toBe(selection);
  });
});
