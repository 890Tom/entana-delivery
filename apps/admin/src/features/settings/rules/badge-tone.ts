/** The text colour that reads best on a badge of a given background. */
export type BadgeTone = "light" | "dark";

const channelOf = (hex: string, start: number): number => {
  const value = Number.parseInt(hex.slice(start, start + 2), 16) / 255;
  return value <= 0.039_28 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
};

/** The relative luminance of WCAG 2 for a `#rrggbb` colour. */
function luminanceOf(color: string): number {
  return 0.2126 * channelOf(color, 1) + 0.7152 * channelOf(color, 3) + 0.0722 * channelOf(color, 5);
}

/**
 * Light text on a dark colour, dark text on a light one: whichever contrasts more with the
 * background (white has a luminance of 1, black of 0). The axis colour is chosen freely, so the
 * number on its badge cannot have a fixed colour.
 */
export function badgeTextTone(color: string): BadgeTone {
  const luminance = luminanceOf(color);
  const contrastWithWhite = 1.05 / (luminance + 0.05);
  const contrastWithBlack = (luminance + 0.05) / 0.05;
  return contrastWithWhite >= contrastWithBlack ? "light" : "dark";
}
