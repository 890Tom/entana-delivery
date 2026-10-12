import { describe, expect, it } from "vitest";
import { buildDateOptions } from "./date-options";

describe("buildDateOptions", () => {
  it("offers every date, today, yesterday and the 5 days before, in that order", () => {
    const options = buildDateOptions("2026-10-01");

    expect(options.map((option) => option.value)).toEqual([
      "",
      "2026-10-01",
      "2026-09-30",
      "2026-09-29",
      "2026-09-28",
      "2026-09-27",
      "2026-09-26",
      "2026-09-25",
    ]);
    expect(options.map((option) => option.kind)).toEqual([
      "all",
      "today",
      "yesterday",
      "earlier",
      "earlier",
      "earlier",
      "earlier",
      "earlier",
    ]);
  });
});
