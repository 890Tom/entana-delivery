type Rgb = readonly [red: number, green: number, blue: number];

const CHANNEL_MAX = 255;

function channelAt(hex: string, start: number): number {
  return Number.parseInt(hex.slice(start, start + 2), 16);
}

function toRgb(hex: string): Rgb {
  return [channelAt(hex, 1), channelAt(hex, 3), channelAt(hex, 5)];
}

function channelToHex(channel: number): string {
  return channel.toString(16).padStart(2, "0");
}

function linearChannel(channel: number): number {
  const value = channel / CHANNEL_MAX;
  return value <= 0.039_28 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

/** The relative luminance of WCAG 2 for a `#rrggbb` colour. */
export function relativeLuminance(hex: string): number {
  const [red, green, blue] = toRgb(hex);
  return 0.2126 * linearChannel(red) + 0.7152 * linearChannel(green) + 0.0722 * linearChannel(blue);
}

/** The contrast ratio of WCAG 2 between two `#rrggbb` colours, from 1 to 21, in either order. */
export function contrastRatio(first: string, second: string): number {
  const firstLuminance = relativeLuminance(first);
  const secondLuminance = relativeLuminance(second);
  return (
    (Math.max(firstLuminance, secondLuminance) + 0.05) /
    (Math.min(firstLuminance, secondLuminance) + 0.05)
  );
}

/**
 * Mixes two colours: `percentOfFirst` (an integer from 0 to 100) of the first, the rest of the
 * second, each channel rounded. An integer percentage keeps the result free of float drift.
 */
export function mixColors(first: string, second: string, percentOfFirst: number): string {
  const [firstRed, firstGreen, firstBlue] = toRgb(first);
  const [secondRed, secondGreen, secondBlue] = toRgb(second);
  const mix = (a: number, b: number): string =>
    channelToHex(Math.round((a * percentOfFirst + b * (100 - percentOfFirst)) / 100));
  return `#${mix(firstRed, secondRed)}${mix(firstGreen, secondGreen)}${mix(firstBlue, secondBlue)}`;
}
