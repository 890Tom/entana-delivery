import { contrastRatio } from "./color-math.js";

// A colour of the interface that is not text (a button, a border, a mark) needs 3:1 (WCAG 1.4.11).
const MIN_NON_TEXT_CONTRAST = 3;
const WHITE = "#ffffff";

export interface ThemeContrastFailure {
  readonly key: "accent" | "action";
  readonly ratio: number;
  readonly minimum: number;
}

/**
 * The brand colours that are too light to be seen on a white page. The text colours and the other
 * derived colours reach their contrast by construction (deriveInstanceTheme), so nothing else is
 * checked.
 */
export function checkThemeContrast(colors: {
  readonly accent: string;
  readonly action: string;
}): ThemeContrastFailure[] {
  return (["accent", "action"] as const)
    .map((key) => ({
      key,
      ratio: contrastRatio(colors[key], WHITE),
      minimum: MIN_NON_TEXT_CONTRAST,
    }))
    .filter((check) => check.ratio < check.minimum);
}
