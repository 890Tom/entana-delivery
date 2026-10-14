import { describe, expect, it } from "vitest";

import { buildAxis } from "../../../test-support/settings/build-axis";

import { AXIS_START_PALETTE, defaultAxisColor } from "./axis-palette";

describe("the colour of a new axis", () => {
  it("is the first colour of the palette when there is no axis", () => {
    expect(defaultAxisColor([])).toBe(AXIS_START_PALETTE[0]);
  });

  it("is the first colour of the palette that no axis uses", () => {
    const axes = [
      buildAxis(1, { color: AXIS_START_PALETTE[0] }),
      buildAxis(2, { color: AXIS_START_PALETTE[2] }),
    ];

    expect(defaultAxisColor(axes)).toBe(AXIS_START_PALETTE[1]);
  });

  it("is the first colour of the palette when every colour is taken", () => {
    const axes = AXIS_START_PALETTE.map((color, index) => buildAxis(index, { color }));

    expect(defaultAxisColor(axes)).toBe(AXIS_START_PALETTE[0]);
  });
});
