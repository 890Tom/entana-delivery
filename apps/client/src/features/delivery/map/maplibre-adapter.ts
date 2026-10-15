import type * as Library from "maplibre-gl";

import { texts } from "../../../i18n/texts";

import type { MapAdapter, MapAdapterOptions, MapLoader, MapZone } from "./map-adapter";
import { createMarkerElement } from "./marker-element";
import { readZoneLineStyle, toZoneFeatures } from "./zone-layer";

// The only file that names the library. It is reached through dynamic imports only, so that the
// library, its style sheet and its worker are one separate chunk that the first page never loads.
type LibraryModule = typeof Library;

const MAP_LOCALE = {
  "Map.Title": texts.delivery.map.canvasLabel,
  "NavigationControl.ZoomIn": texts.delivery.map.zoomIn,
  "NavigationControl.ZoomOut": texts.delivery.map.zoomOut,
  "AttributionControl.ToggleAttribution": texts.delivery.map.toggleAttribution,
};

function createMarkerHandle(
  library: LibraryModule,
  map: Library.Map,
  onPick: MapAdapterOptions["onPick"],
): MapAdapter["setMarker"] {
  let marker: Library.Marker | null = null;
  return (point) => {
    if (point === null) {
      marker?.remove();
      marker = null;
      return;
    }
    if (marker !== null) {
      marker.setLngLat([point.lng, point.lat]);
      return;
    }
    const created = new library.Marker({
      element: createMarkerElement(texts.delivery.map.markerLabel),
      draggable: true,
      anchor: "bottom",
    })
      .setLngLat([point.lng, point.lat])
      .addTo(map);
    created.on("dragend", () => {
      const { lat, lng } = created.getLngLat().wrap();
      onPick({ lat, lng });
    });
    marker = created;
  };
}

const ZONES_ID = "delivery-zones";

/** One source and one dashed line layer for every circle, under the marker (a DOM element). */
function createZonesHandle(map: Library.Map, container: HTMLElement): MapAdapter["setZones"] {
  const style = readZoneLineStyle(container);
  map.addSource(ZONES_ID, { type: "geojson", data: toZoneFeatures([]) });
  map.addLayer({
    id: ZONES_ID,
    type: "line",
    source: ZONES_ID,
    paint: { "line-color": style.color, "line-width": style.width, "line-dasharray": style.dash },
  });
  return (zones: readonly MapZone[]) => {
    // The library parses the data in its worker: nothing waits for it, and nothing can fail here.
    void map.getSource<Library.GeoJSONSource>(ZONES_ID)?.setData(toZoneFeatures(zones));
  };
}

function createAdapter(
  library: LibraryModule,
  map: Library.Map,
  options: MapAdapterOptions,
): MapAdapter {
  // Wrapped: a map panned across the antimeridian reports a longitude beyond 180.
  map.on("click", ({ lngLat }) => {
    const { lat, lng } = lngLat.wrap();
    options.onPick({ lat, lng });
  });
  const setMarker = createMarkerHandle(library, map, options.onPick);
  return {
    setMarker,
    setZones: createZonesHandle(map, options.container),
    centreOn: (point, zoom) => {
      const center: [number, number] = [point.lng, point.lat];
      const view = { center, zoom };
      // No animation when the system asks for less motion.
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        map.jumpTo(view);
        return;
      }
      map.easeTo(view);
    },
    getCenter: () => {
      const { lat, lng } = map.getCenter().wrap();
      return { lat, lng };
    },
    destroy: () => {
      setMarker(null);
      map.remove();
    },
  };
}

function createMap(library: LibraryModule, options: MapAdapterOptions): Library.Map {
  const map = new library.Map({
    container: options.container,
    style: options.styleUrl,
    center: [options.center.lng, options.center.lat],
    zoom: options.zoom,
    // The credits stay open: collapsed behind a button they would not be readable on a phone.
    attributionControl: { compact: false },
    locale: MAP_LOCALE,
    dragRotate: false,
    touchPitch: false,
  });
  map.touchZoomRotate.disableRotation();
  map.keyboard.disableRotation();
  map.addControl(new library.NavigationControl({ showCompass: false }), "top-left");
  return map;
}

/** Loads the library, creates the map, and resolves when its style has loaded. */
export const loadMapLibreAdapter: MapLoader = async (options) => {
  const [library, worker] = await Promise.all([
    import("maplibre-gl"),
    import("maplibre-gl/dist/maplibre-gl-worker.mjs?url"),
    import("maplibre-gl/dist/maplibre-gl.css"),
  ]);
  // The worker is a file of the application (same origin), not a blob: a strict policy allows it.
  library.setWorkerUrl(worker.default);
  const map = createMap(library, options);
  return new Promise<MapAdapter>((resolve, reject) => {
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
      resolve(createAdapter(library, map, options));
    });
  });
};
