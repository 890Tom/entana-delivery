import { describe, expect, it } from "vitest";

import { formatDistance } from "./format-distance";

describe("formatDistance", () => {
  it("writes one decimal with a comma and a non-breaking space before km", () => {
    expect(formatDistance(0.43)).toBe("0,4 km");
  });

  it("keeps the decimal of a round distance", () => {
    expect(formatDistance(2)).toBe("2,0 km");
  });
});
