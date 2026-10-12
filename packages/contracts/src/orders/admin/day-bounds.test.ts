import { describe, expect, it } from "vitest";
import { dayBoundsInTimeZone } from "./day-bounds.js";

describe("dayBoundsInTimeZone", () => {
  it("starts a day of Indian/Antananarivo (UTC+3) at 21:00 UTC of the day before", () => {
    const bounds = dayBoundsInTimeZone("2026-10-08", "Indian/Antananarivo");

    expect(bounds.start.toISOString()).toBe("2026-10-07T21:00:00.000Z");
    expect(bounds.end.toISOString()).toBe("2026-10-08T21:00:00.000Z");
  });

  it("is the UTC day in UTC", () => {
    const bounds = dayBoundsInTimeZone("2026-12-31", "UTC");

    expect(bounds.start.toISOString()).toBe("2026-12-31T00:00:00.000Z");
    expect(bounds.end.toISOString()).toBe("2027-01-01T00:00:00.000Z");
  });

  it("follows a daylight saving change: that day lasts 23 hours", () => {
    const bounds = dayBoundsInTimeZone("2026-03-29", "Europe/Paris");

    expect(bounds.start.toISOString()).toBe("2026-03-28T23:00:00.000Z");
    expect(bounds.end.toISOString()).toBe("2026-03-29T22:00:00.000Z");
  });
});
