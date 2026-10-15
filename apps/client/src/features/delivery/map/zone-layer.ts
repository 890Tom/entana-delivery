import { toCircleRing } from "../rules/to-circle-ring";

import type { MapZone } from "./map-adapter";

/** The circles as GeoJSON lines: an outline only, the map stays readable under it. */
export interface ZoneFeatures {
  readonly type: "FeatureCollection";
  readonly features: {
    readonly type: "Feature";
    readonly properties: Record<string, never>;
    readonly geometry: { readonly type: "LineString"; readonly coordinates: [number, number][] };
  }[];
}

export interface ZoneLineStyle {
  readonly color: string;
  readonly width: number;
  /** In line widths, as the library counts a dash, not in pixels. */
  readonly dash: number[];
}

export function toZoneFeatures(zones: readonly MapZone[]): ZoneFeatures {
  return {
    type: "FeatureCollection",
    features: zones.map((zone) => ({
      type: "Feature",
      properties: {},
      geometry: { type: "LineString", coordinates: toCircleRing(zone.center, zone.radiusM) },
    })),
  };
}

/**
 * The look of a circle, read from the design tokens on the map's box: the library paints on a
 * canvas, which cannot read a CSS variable by itself.
 */
export function readZoneLineStyle(element: HTMLElement): ZoneLineStyle {
  const style = getComputedStyle(element);
  const width = Number.parseFloat(style.getPropertyValue("--size-map-zone-stroke"));
  const dash = style
    .getPropertyValue("--map-zone-dash")
    .trim()
    .split(/\s+/)
    .map((length) => Number.parseFloat(length) / width);
  return { color: style.getPropertyValue("--color-ink").trim(), width, dash };
}
