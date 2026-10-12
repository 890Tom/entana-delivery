import { describe, expect, it } from "vitest";

import { describeInstant, formatEventTime, formatLongDay } from "./format-detail";

// 09:00 UTC is 12:00 in the shop (UTC+3): the day of the shop is 2026-10-01.
const NOW = new Date("2026-10-01T09:00:00.000Z");

describe("formatLongDay", () => {
  it("writes the weekday, the day and the whole month", () => {
    expect(formatLongDay("2026-10-03")).toBe("sam. 3 octobre");
  });
});

describe("describeInstant", () => {
  it("says an instant of the same day of the shop is today", () => {
    expect(describeInstant("2026-10-01T06:47:00.000Z", NOW)).toEqual({
      relation: "today",
      time: "9 h 47",
      date: "1 oct.",
    });
  });

  it("reads the day in the zone of the shop: 22:30 UTC is already the next day there", () => {
    expect(describeInstant("2026-09-30T22:30:00.000Z", NOW).relation).toBe("today");
  });

  it("says the day before is yesterday", () => {
    expect(describeInstant("2026-09-30T06:47:00.000Z", NOW).relation).toBe("yesterday");
  });

  it("gives the date of an older day", () => {
    expect(describeInstant("2026-09-28T06:47:00.000Z", NOW)).toEqual({
      relation: "other",
      time: "9 h 47",
      date: "28 sept.",
    });
  });
});

describe("formatEventTime", () => {
  it("shows the time only for today", () => {
    expect(formatEventTime({ relation: "today", time: "9 h 47", date: "1 oct." })).toBe("9 h 47");
  });

  it("adds the date for another day", () => {
    expect(formatEventTime({ relation: "other", time: "9 h 47", date: "28 sept." })).toBe(
      "28 sept. · 9 h 47",
    );
  });
});
