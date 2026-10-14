import type { AdminDeliveryAxis } from "@entana/contracts";

/**
 * The colours offered first to a new axis. Data, not design tokens: the colour of an axis is
 * chosen by the shop and stored with it; these are the former ten axis colours, each at least
 * 5.8:1 on white.
 */
export const AXIS_START_PALETTE = [
  "#2f6b5a",
  "#9a4a2a",
  "#7a2e5a",
  "#7a5a1e",
  "#2d5b8c",
  "#a23b3b",
  "#5b3f8c",
  "#1f6e78",
  "#5e6b23",
  "#4a5260",
] as const;

/** The first colour of the palette that no axis uses; the first one when all are taken. */
export function defaultAxisColor(axes: readonly AdminDeliveryAxis[]): string {
  const used = new Set(axes.map((axis) => axis.color.toLowerCase()));
  return AXIS_START_PALETTE.find((color) => !used.has(color)) ?? AXIS_START_PALETTE[0];
}
