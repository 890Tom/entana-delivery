import type * as Library from "maplibre-gl";

import { texts } from "../../../i18n/texts";

import { createMarkerElement } from "./marker-element";

// The only file that names the library. It is reached through dynamic imports only, so that the
// library, its style sheet and its worker are one separate chunk that the list never loads.

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
  const [library, worker] = await Promise.all([
    import("maplibre-gl"),
    import("maplibre-gl/dist/maplibre-gl-worker.mjs?url"),
    import("maplibre-gl/dist/maplibre-gl.css"),
  ]);
  // The worker is a file of the application (same origin), not a blob: a strict policy allows it.
  library.setWorkerUrl(worker.default);
  const map = createMap(library, options);
  return new Promise<ReadonlyMapHandle>((resolve, reject) => {
    let isLoaded = false;
    // An error before the first load is the style or the library failing; a tile that fails later
    // is a gap in the picture, not a reason to take the map away.
    map.on("error", () => {
      if (!isLoaded) {
        map.remove();
        reject(new Error("The map could not be loaded"));
      }
    });
    map.once("load", () => {
      isLoaded = true;
      resolve({
        destroy: () => {
          map.remove();
        },
      });
    });
  });
}
