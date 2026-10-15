import type * as Library from "maplibre-gl";

import { texts } from "../../../i18n/texts";
import { loadMapLibrary, whenMapLoaded } from "../../../map/load-maplibre";

import { createMarkerElement } from "../../../map/marker-element";

// The only file of the order sheet that names the library. It is reached through dynamic imports
// only, so that the library, its style sheet and its worker are one separate chunk.

export interface ReadonlyMapOptions {
  readonly container: HTMLElement;
  readonly styleUrl: string;
  /** Personal data: never logged. */
  readonly point: { readonly lat: number; readonly lng: number };
  readonly zoom: number;
}

export interface ReadonlyMapHandle {
  readonly destroy: () => void;
}

const t = texts.orderDetail.address;

const MAP_LOCALE = {
  "Map.Title": t.canvasLabel,
  "NavigationControl.ZoomIn": t.zoomIn,
  "NavigationControl.ZoomOut": t.zoomOut,
  "AttributionControl.ToggleAttribution": t.toggleAttribution,
};

function createMap(library: typeof Library, options: ReadonlyMapOptions): Library.Map {
  const map = new library.Map({
    container: options.container,
    style: options.styleUrl,
    center: [options.point.lng, options.point.lat],
    zoom: options.zoom,
    // The credits stay open: they are the attribution that the tiles' licence asks for.
    attributionControl: { compact: false },
    locale: MAP_LOCALE,
    dragRotate: false,
    touchPitch: false,
  });
  map.touchZoomRotate.disableRotation();
  map.keyboard.disableRotation();
  map.addControl(new library.NavigationControl({ showCompass: false }), "top-left");
  new library.Marker({ element: createMarkerElement(t.markerLabel), anchor: "bottom" })
    .setLngLat([options.point.lng, options.point.lat])
    .addTo(map);
  return map;
}

/** Loads the library, draws the point on a map that can be zoomed, resolves once the style is in. */
export async function loadReadonlyMap(options: ReadonlyMapOptions): Promise<ReadonlyMapHandle> {
  const library = await loadMapLibrary();
  const map = createMap(library, options);
  return whenMapLoaded(map, {
    destroy: () => {
      map.remove();
    },
  });
}
