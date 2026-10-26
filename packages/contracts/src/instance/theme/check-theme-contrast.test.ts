import { describe, expect, it } from "vitest";
import { checkThemeContrast } from "./check-theme-contrast.js";

describe("checkThemeContrast", () => {
  it("accepts colours that reach 3:1 on white", () => {
    expect(checkThemeContrast({ accent: "#2d6cdf", action: "#2b2b2b" })).toEqual([]);
  });

  it.each([
    ["accent", { accent: "#f5e663", action: "#2b2b2b" }],
    ["action", { accent: "#2d6cdf", action: "#f5e663" }],
  ])("names the %s key when that colour is too light on white", (key, colors) => {
    const failures = checkThemeContrast(colors);

    expect(failures).toHaveLength(1);
    expect(failures[0]).toMatchObject({ key, minimum: 3 });
    expect(failures[0]?.ratio).toBeLessThan(3);
  });
});
