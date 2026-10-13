import type { GeoPoint } from "../../delivery/map/map-adapter";

/** A reseller as the map draws it: a name for assistive technology and a place. */
export interface MapShop {
  readonly id: string;
  readonly name: string;
  readonly point: GeoPoint;
}

/**
 * What the screen needs from the map of the resellers, and nothing of the library: the screen is
 * tested with a fake one, because the real one needs WebGL. The position of the customer only
 * ever goes into `setUserPosition`: the map draws it and keeps it nowhere else.
 */
export interface ResellersMapAdapter {
  /** The markers to show: the ones that are not in the list are removed. */
  readonly setShops: (shops: readonly MapShop[]) => void;
  /** Highlights one marker, or none. */
  readonly setSelected: (id: string | null) => void;
  readonly setUserPosition: (point: GeoPoint | null) => void;
  /** Moves the centre to this point and keeps the zoom. */
  readonly centreOn: (point: GeoPoint) => void;
  readonly destroy: () => void;
}

export interface ResellersMapOptions {
  readonly container: HTMLElement;
  readonly styleUrl: string;
  readonly center: GeoPoint;
  readonly zoom: number;
  /** A marker was activated (pointer or keyboard). */
  readonly onSelect: (id: string) => void;
}

/** Resolves when the map is ready to be used; rejects when it cannot be shown. */
export type ResellersMapLoader = (options: ResellersMapOptions) => Promise<ResellersMapAdapter>;
