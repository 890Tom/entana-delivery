/** A position on the earth in degrees. Personal data: never logged, never put in an address. */
export interface GeoPoint {
  readonly lat: number;
  readonly lng: number;
}

/**
 * What the screen needs from a map, and nothing of the library: the screen is tested with a fake
 * one, because the real one needs WebGL.
 */
export interface MapAdapter {
  /** Shows the delivery marker at this point, or removes it. */
  readonly setMarker: (point: GeoPoint | null) => void;
  readonly centreOn: (point: GeoPoint, zoom: number) => void;
  readonly getCenter: () => GeoPoint;
  readonly destroy: () => void;
}

export interface MapAdapterOptions {
  readonly container: HTMLElement;
  readonly styleUrl: string;
  readonly center: GeoPoint;
  readonly zoom: number;
  /** The user tapped the map, or dropped the marker, here. The point is not validated yet. */
  readonly onPick: (point: GeoPoint) => void;
}

/** Resolves when the map is ready to be used; rejects when it cannot be shown. */
export type MapLoader = (options: MapAdapterOptions) => Promise<MapAdapter>;
