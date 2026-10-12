import { describe, expect, it } from "vitest";
import {
  MAX_DELIVERY_DAYS_AHEAD,
  dayInTimeZone,
  isDeliveryDateInWindow,
} from "./delivery-date-window.js";

describe("dayInTimeZone", () => {
  it("gives the day of the time zone, not the UTC day", () => {
    const lateEveningUtc = new Date("2026-10-08T22:30:00.000Z");

    expect(dayInTimeZone(lateEveningUtc, "UTC")).toBe("2026-10-08");
    expect(dayInTimeZone(lateEveningUtc, "Indian/Antananarivo")).toBe("2026-10-09");
  });
});

describe("isDeliveryDateInWindow", () => {
  it.each([
    ["today", "2026-10-08", true],
    ["the last allowed day", "2026-12-07", true],
    ["yesterday", "2026-10-07", false],
    ["one day too far", "2026-12-08", false],
  ])("answers for %s", (_label, day, isAllowed) => {
    expect(MAX_DELIVERY_DAYS_AHEAD).toBe(60);
    expect(isDeliveryDateInWindow(day, "2026-10-08")).toBe(isAllowed);
  });
});
