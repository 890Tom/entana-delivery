import { describe, expect, it } from "vitest";

import { buildDirectionsUrl } from "./build-directions-url";

describe("buildDirectionsUrl", () => {
  it("goes to the coordinates of the reseller", () => {
    expect(buildDirectionsUrl({ latitude: -18.9123, longitude: 47.5234 })).toBe(
      "https://www.google.com/maps/dir/?api=1&destination=-18.9123,47.5234",
    );
  });
});
