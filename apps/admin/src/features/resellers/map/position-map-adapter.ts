import type * as Library from "maplibre-gl";

import { texts } from "../../../i18n/texts";
import { loadMapLibrary, whenMapLoaded } from "../../../map/load-maplibre";
import { createMarkerElement } from "../../../map/marker-element";
import type { MapPoint } from "../rules/reseller-form";

// The only file of the resellers that names the library. It is reached through dynamic imports
// only, so that the library, its style sheet and its worker stay one separate chunk.

export interface PositionMapOptions {
  readonly container: HTMLElement;
  readonly styleUrl: string;
  /** The view of the shop, used while the reseller has no position. */
  readonly center: MapPoint;
  readonly zoom: number;
  /** Personal data: never logged. */
  readonly point: MapPoint | null;
  /** The person clicked the map or dropped the marker. */
  readonly onPick: (point: MapPoint) => void;
}

export interface PositionMapHandle {
  /** Moves the marker (and the view) to a point typed elsewhere; null removes the marker. */
  readonly setPoint: (point: MapPoint | null) => void;
  readonly destroy: () => void;
}

const t = texts.resellers.form.map;

/** The street level of a point that was placed or typed. */
const POINT_ZOOM = 16;

const MAP_LOCALE = {
  "Map.Title": t.canvasLabel,
  "NavigationControl.ZoomIn": t.zoomIn,
  "NavigationControl.ZoomOut": t.zoomOut,
  "AttributionControl.ToggleAttribution": t.toggleAttribution,
};

function createMap(library: typeof Library, options: PositionMapOptions): Library.Map {
  const start = options.point ?? options.center;
  const map = new library.Map({
    container: options.container,
    style: options.styleUrl,
    center: [start.lng, start.lat],
    zoom: options.point === null ? options.zoom : POINT_ZOOM,
    // The credits come with the style and stay open: they are the attribution of the tiles.
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

/** The marker of the position: created at the first point, then moved; dropping it picks. */
function createMarkerController(
  library: typeof Library,
  map: Library.Map,
  onPick: PositionMapOptions["onPick"],
): { place: (point: MapPoint) => void; remove: () => void } {
  let marker: Library.Marker | null = null;
  return {
    place: (point) => {
      if (marker !== null) {
        marker.setLngLat([point.lng, point.lat]);
        return;
      }
      const created = new library.Marker({
        element: createMarkerElement(t.markerLabel),
        anchor: "bottom",
        draggable: true,
      })
        .setLngLat([point.lng, point.lat])
        .addTo(map);
      created.on("dragend", () => {
        const { lat, lng } = created.getLngLat();
        onPick({ lat, lng });
      });
      marker = created;
    },
    remove: () => {
      marker?.remove();
      marker = null;
    },
  };
}

function createController(
  library: typeof Library,
  map: Library.Map,
  onPick: PositionMapOptions["onPick"],
): PositionMapHandle {
  const marker = createMarkerController(library, map, onPick);
  map.on("click", (event) => {
    onPick({ lat: event.lngLat.lat, lng: event.lngLat.lng });
  });
  return {
    setPoint: (point) => {
      if (point === null) {
        marker.remove();
        return;
      }
      marker.place(point);
      map.easeTo({ center: [point.lng, point.lat] });
    },
    destroy: () => {
      map.remove();
    },
  };
}

/** Loads the library, draws the map and resolves once the style is in. */
export async function loadPositionMap(options: PositionMapOptions): Promise<PositionMapHandle> {
  const library = await loadMapLibrary();
  const map = createMap(library, options);
  const handle = createController(library, map, options.onPick);
  if (options.point !== null) {
    handle.setPoint(options.point);
  }
  return whenMapLoaded(map, handle);
}
