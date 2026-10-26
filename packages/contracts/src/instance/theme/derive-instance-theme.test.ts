import { describe, expect, it } from "vitest";
import { contrastRatio } from "./color-math.js";
import { deriveInstanceTheme, instanceThemeSchema } from "./derive-instance-theme.js";

const MIN_TEXT_CONTRAST = 4.5;
const DARK_REFERENCE = { accent: "#2d6cdf", action: "#2b2b2b" };
const LIGHT_REFERENCE = { accent: "#d97706", action: "#d97706" };

describe("deriveInstanceTheme", () => {
  it("derives the seven colours of a dark reference, with white text", () => {
    expect(deriveInstanceTheme(DARK_REFERENCE)).toEqual({
      accent: "#2d6cdf",
      accentSoft: "#e0e9fa",
      accentStrong: "#2961c9",
      textOnAccent: "#ffffff",
      action: "#2b2b2b",
      actionHover: "#555555",
      textOnAction: "#ffffff",
    });
  });

  it("derives the seven colours of a light reference, with dark text and a lighter hover", () => {
    expect(deriveInstanceTheme(LIGHT_REFERENCE)).toEqual({
      accent: "#d97706",
      accentSoft: "#f9ebda",
      accentStrong: "#985304",
      textOnAccent: "#1a1a1a",
      action: "#d97706",
      actionHover: "#e19238",
      textOnAction: "#1a1a1a",
    });
  });

  it.each([
    ["dark", DARK_REFERENCE],
    ["light", LIGHT_REFERENCE],
  ])("gives valid hex colours and the required contrasts on the %s reference", (_label, colors) => {
    const theme = deriveInstanceTheme(colors);

    expect(instanceThemeSchema.safeParse(theme).success).toBe(true);
    expect(contrastRatio(theme.textOnAccent, theme.accent)).toBeGreaterThanOrEqual(
      MIN_TEXT_CONTRAST,
    );
    expect(contrastRatio(theme.textOnAction, theme.action)).toBeGreaterThanOrEqual(
      MIN_TEXT_CONTRAST,
    );
    expect(contrastRatio(theme.accentStrong, theme.accentSoft)).toBeGreaterThanOrEqual(
      MIN_TEXT_CONTRAST,
    );
    expect(contrastRatio(theme.actionHover, theme.textOnAction)).toBeGreaterThanOrEqual(
      MIN_TEXT_CONTRAST,
    );
  });

  it("darkens the hover of a white-text action when lightening it would lose the contrast", () => {
    const theme = deriveInstanceTheme({ accent: "#2d6cdf", action: "#2d6cdf" });

    expect(theme.textOnAction).toBe("#ffffff");
    expect(theme.actionHover).toBe("#265cbe");
  });

  it("falls back to black text on a mid grey that neither white nor dark text can serve", () => {
    const theme = deriveInstanceTheme({ accent: "#7a7a7a", action: "#7a7a7a" });

    expect(theme.textOnAccent).toBe("#000000");
    expect(theme.textOnAction).toBe("#000000");
    expect(contrastRatio(theme.textOnAccent, theme.accent)).toBeGreaterThanOrEqual(
      MIN_TEXT_CONTRAST,
    );
    expect(contrastRatio(theme.actionHover, theme.textOnAction)).toBeGreaterThanOrEqual(
      MIN_TEXT_CONTRAST,
    );
  });
});
