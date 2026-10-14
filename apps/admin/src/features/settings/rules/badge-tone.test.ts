import { describe, expect, it } from "vitest";

import { AXIS_START_PALETTE } from "./axis-palette";
import { badgeTextTone } from "./badge-tone";

describe("the colour of the number on a badge", () => {
  it.each(AXIS_START_PALETTE)("is light on the dark colour %s of the palette", (color) => {
    expect(badgeTextTone(color)).toBe("light");
  });

  it.each(["#ffffff", "#f5e663", "#9fd8c4"])("is dark on the light colour %s", (color) => {
    expect(badgeTextTone(color)).toBe("dark");
  });

  it("is light on black", () => {
    expect(badgeTextTone("#000000")).toBe("light");
  });
});
