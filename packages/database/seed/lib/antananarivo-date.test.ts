import { describe, expect, it } from "vitest";
import { addDays, localHourOnDay, todayInAntananarivo } from "./antananarivo-date.ts";

describe("todayInAntananarivo", () => {
  it("is the same day at midday UTC", () => {
    expect(todayInAntananarivo(new Date("2026-10-05T12:00:00Z"))).toBe("2026-10-05");
  });

  it("is already the next day from 21:00 UTC (UTC+3)", () => {
    expect(todayInAntananarivo(new Date("2026-10-05T20:59:59Z"))).toBe("2026-10-05");
    expect(todayInAntananarivo(new Date("2026-10-05T21:00:00Z"))).toBe("2026-10-06");
  });

  it("crosses a year end", () => {
    expect(todayInAntananarivo(new Date("2026-12-31T22:00:00Z"))).toBe("2027-01-01");
  });
});

describe("addDays", () => {
  it("adds and subtracts days", () => {
    expect(addDays("2026-10-05", 2)).toBe("2026-10-07");
    expect(addDays("2026-10-05", -2)).toBe("2026-10-03");
    expect(addDays("2026-10-05", 0)).toBe("2026-10-05");
  });

  it("crosses month and year boundaries", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(addDays("2028-03-01", -1)).toBe("2028-02-29");
  });

  it("rejects a value that is not a day", () => {
    expect(() => addDays("tomorrow", 1)).toThrow(RangeError);
  });
});

describe("localHourOnDay", () => {
  it("converts the local hour to UTC", () => {
    expect(localHourOnDay("2026-10-05", 8).toISOString()).toBe("2026-10-05T05:00:00.000Z");
  });

  it("stays on the same local day, including before 03:00 UTC+3", () => {
    expect(todayInAntananarivo(localHourOnDay("2026-10-05", 0))).toBe("2026-10-05");
    expect(todayInAntananarivo(localHourOnDay("2026-10-05", 23))).toBe("2026-10-05");
  });

  it("rejects a value that is not a day", () => {
    expect(() => localHourOnDay("soon", 8)).toThrow(RangeError);
  });
});
