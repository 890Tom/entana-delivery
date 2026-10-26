import { describe, expect, it } from "vitest";
import { contrastRatio, mixColors, relativeLuminance } from "./color-math.js";

describe("color math", () => {
  it("gives a luminance of 1 to white and 0 to black", () => {
    expect(relativeLuminance("#ffffff")).toBeCloseTo(1, 10);
    expect(relativeLuminance("#000000")).toBe(0);
  });

  it("gives a contrast of 21 between black and white, whatever the order", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 10);
    expect(contrastRatio("#ffffff", "#000000")).toBeCloseTo(21, 10);
  });

  it("mixes two colours by the percentage of the first, rounding each channel", () => {
    expect(mixColors("#ff0000", "#000000", 50)).toBe("#800000");
    expect(mixColors("#102030", "#ffffff", 100)).toBe("#102030");
    expect(mixColors("#102030", "#ffffff", 0)).toBe("#ffffff");
  });
});
