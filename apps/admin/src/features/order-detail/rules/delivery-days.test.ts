import { MAX_DELIVERY_DAYS_AHEAD } from "@entana/contracts";
import { describe, expect, it } from "vitest";

import {
  addDays,
  buildQuickDays,
  deliveryWindow,
  isChoosableDay,
  resolveChosenDay,
} from "./delivery-days";

describe("buildQuickDays", () => {
  it("gives today, tomorrow and the day after, across a month end", () => {
    expect(buildQuickDays("2026-09-30")).toEqual([
      { key: "today", day: "2026-09-30" },
      { key: "tomorrow", day: "2026-10-01" },
      { key: "dayAfter", day: "2026-10-02" },
    ]);
  });
});

describe("addDays", () => {
  it("moves a plain day with no zone conversion", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-10-01", -1)).toBe("2026-09-30");
  });
});

describe("deliveryWindow", () => {
  it("runs from today to the last day the shop may schedule", () => {
    expect(deliveryWindow("2026-10-01")).toEqual({
      min: "2026-10-01",
      max: addDays("2026-10-01", MAX_DELIVERY_DAYS_AHEAD),
    });
  });
});

describe("isChoosableDay", () => {
  const today = "2026-10-01";

  it.each([
    ["today", "2026-10-01", true],
    ["the last day of the window", addDays(today, MAX_DELIVERY_DAYS_AHEAD), true],
    ["yesterday", "2026-09-30", false],
    ["the day after the window", addDays(today, MAX_DELIVERY_DAYS_AHEAD + 1), false],
    ["an empty value", "", false],
    ["a text that is not a day", "demain", false],
  ])("answers for %s", (_label, day, isChoosable) => {
    expect(isChoosableDay(day, today)).toBe(isChoosable);
  });
});

describe("resolveChosenDay", () => {
  const today = "2026-10-01";

  it("has no day until one is picked", () => {
    expect(resolveChosenDay(null, "", today)).toEqual({ day: null, isInvalid: false });
  });

  it("gives the day of a quick choice", () => {
    expect(resolveChosenDay({ kind: "quick", key: "dayAfter" }, "", today)).toEqual({
      day: "2026-10-03",
      isInvalid: false,
    });
  });

  it("waits for a typed day, takes it inside the window and flags it outside", () => {
    const other = { kind: "other" } as const;
    expect(resolveChosenDay(other, "", today)).toEqual({ day: null, isInvalid: false });
    expect(resolveChosenDay(other, "2026-10-20", today)).toEqual({
      day: "2026-10-20",
      isInvalid: false,
    });
    expect(resolveChosenDay(other, "2027-01-01", today)).toEqual({ day: null, isInvalid: true });
  });
});
