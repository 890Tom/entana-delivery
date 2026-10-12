import { describe, expect, it } from "vitest";
import { formatAmount, formatDay, formatPhone, formatTime, todayInShop } from "./format-order";

describe("formatAmount", () => {
  it.each([
    [500, "500 Ar"],
    [8500, "8 500 Ar"],
    [1234567, "1 234 567 Ar"],
  ])("writes %d with a no-break space", (amount, expected) => {
    expect(formatAmount(amount)).toBe(expected);
  });
});

describe("formatTime", () => {
  it("reads the hour in the time zone of the shop (UTC+3), minutes on two digits", () => {
    expect(formatTime("2026-10-08T07:12:00.000Z")).toBe("10 h 12");
    expect(formatTime("2026-10-08T04:05:00.000Z")).toBe("7 h 05");
  });
});

describe("formatDay", () => {
  it("writes a day as weekday, day and month, whatever the zone of the browser", () => {
    expect(formatDay("2026-10-02")).toBe("ven. 2 oct.");
  });
});

describe("todayInShop", () => {
  it("is already the next day at 22:00 UTC", () => {
    expect(todayInShop(new Date("2026-10-08T22:00:00Z"))).toBe("2026-10-09");
  });
});

describe("formatPhone", () => {
  it("writes the national form with the trunk zero", () => {
    expect(formatPhone("+261340000000", "261")).toBe("034 00 000 00");
  });

  it("keeps a number of another country as it is", () => {
    expect(formatPhone("+33612345678", "261")).toBe("+33612345678");
  });
});
