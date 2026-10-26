import { z } from "zod";
import { contrastRatio, mixColors } from "./color-math.js";
import { hexColorSchema } from "./hex-color.js";

const WHITE = "#ffffff";
const BLACK = "#000000";
// Independent of the ink colour of the theme: a fixed dark that is tried before black.
const DARK_TEXT_COLOR = "#1a1a1a";
const MIN_TEXT_CONTRAST = 4.5;

const ACCENT_SOFT_PERCENT_OF_ACCENT = 15;
const ACCENT_STRONG_STEP_PERCENT = 10;
const HOVER_LIGHTEN_PERCENT_OF_ACTION = 80;
const HOVER_DARKEN_PERCENT_OF_ACTION = 85;

/** The seven colours the customer app and the administration paint with. */
export const instanceThemeSchema = z.strictObject({
  accent: hexColorSchema,
  accentSoft: hexColorSchema,
  accentStrong: hexColorSchema,
  textOnAccent: hexColorSchema,
  action: hexColorSchema,
  actionHover: hexColorSchema,
  textOnAction: hexColorSchema,
});

export type InstanceTheme = z.infer<typeof instanceThemeSchema>;

/** White or the fixed dark, whichever reads better (white on a tie); black when neither reaches 4.5:1. */
function textColorOn(background: string): string {
  const best =
    contrastRatio(WHITE, background) >= contrastRatio(DARK_TEXT_COLOR, background)
      ? WHITE
      : DARK_TEXT_COLOR;
  return contrastRatio(best, background) >= MIN_TEXT_CONTRAST ? best : BLACK;
}

/** The accent darkened by steps of 10 % toward black until it reads on the soft accent. */
function deriveAccentStrong(accent: string, accentSoft: string): string {
  for (let step = 0; step * ACCENT_STRONG_STEP_PERCENT < 100; step += 1) {
    const candidate = mixColors(accent, BLACK, 100 - step * ACCENT_STRONG_STEP_PERCENT);
    if (contrastRatio(candidate, accentSoft) >= MIN_TEXT_CONTRAST) {
      return candidate;
    }
  }
  return BLACK;
}

/**
 * Lighter under dark text, darker under white text; the other way when the first would lose the
 * contrast. The other way always gains contrast, so the text stays readable on the hover.
 */
function deriveActionHover(action: string, textOnAction: string): string {
  const lighter = mixColors(action, WHITE, HOVER_LIGHTEN_PERCENT_OF_ACTION);
  const darker = mixColors(action, BLACK, HOVER_DARKEN_PERCENT_OF_ACTION);
  const [first, second] = textOnAction === WHITE ? [lighter, darker] : [darker, lighter];
  return contrastRatio(first, textOnAction) >= MIN_TEXT_CONTRAST ? first : second;
}

/** Derives the whole theme from the two colours of the configuration file. */
export function deriveInstanceTheme(colors: {
  readonly accent: string;
  readonly action: string;
}): InstanceTheme {
  const accentSoft = mixColors(colors.accent, WHITE, ACCENT_SOFT_PERCENT_OF_ACCENT);
  const textOnAction = textColorOn(colors.action);
  return {
    accent: colors.accent,
    accentSoft,
    accentStrong: deriveAccentStrong(colors.accent, accentSoft),
    textOnAccent: textColorOn(colors.accent),
    action: colors.action,
    actionHover: deriveActionHover(colors.action, textOnAction),
    textOnAction,
  };
}
