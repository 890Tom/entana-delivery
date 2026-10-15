import type { GeoPoint } from "@entana/contracts";
import type * as Library from "maplibre-gl";

import { texts } from "../../../i18n/texts";
import { loadMapLibrary, whenMapLoaded } from "../../../map/load-maplibre";
import type { MapLibrary } from "../../../map/load-maplibre";
import { createMarkerElement } from "../../../map/marker-element";
import { boundsOf, toShapes } from "../rules/axes-drawing";
import type { DrawnAxis } from "../rules/axes-drawing";

// The only file of the settings that names the library. It is reached through dynamic imports
// only, so that the library, its style sheet and its worker stay one separate chunk.

export interface AxesMapOptions {
  readonly container: HTMLElement;
  readonly styleUrl: string;
  /** The view of the shop, used when no place is drawn. */
  readonly center: GeoPoint;
  readonly zoom: number;
  /** In drawing order: the last one is on top. */
  readonly axes: readonly DrawnAxis[];
  /** The person clicked the map: the point to test. */
  readonly onPick: (point: GeoPoint) => void;
}

export interface AxesMapHandle {
  /** Draws the axes again (a new priority changes which one is on top). */
  readonly setAxes: (axes: readonly DrawnAxis[]) => void;
  /** Moves the marker of the tested address; null removes it. */
  readonly setTestPoint: (point: GeoPoint | null) => void;
  readonly destroy: () => void;
}

const t = texts.settings.map;

const SOURCE_ID = "axes";
/** Room around the places of the first view, in pixels, so that no circle touches the edge. */
const FIT_PADDING = 48;
/** A single place is not shown at street level: its surroundings matter as much. */
const FIT_MAX_ZOOM = 14;

const MAP_LOCALE = {
  "Map.Title": t.canvasLabel,
  "NavigationControl.ZoomIn": t.zoomIn,
  "NavigationControl.ZoomOut": t.zoomOut,
  "AttributionControl.ToggleAttribution": t.toggleAttribution,
};

interface Look {
  readonly fillOpacity: number;
  readonly lineWidth: number;
}

/** The colours and widths come from the design tokens, so that a theme changes the map too. */
function readLook(container: HTMLElement): Look {
  const style = getComputedStyle(container);
  const token = (name: string): string => style.getPropertyValue(name).trim();
  return {
    fillOpacity: Number.parseFloat(token("--map-zone-fill-opacity")),
    lineWidth: Number.parseFloat(token("--map-zone-line-width")),
  };
}

function firstView(options: AxesMapOptions): Partial<Library.MapOptions> {
  const bounds = boundsOf(options.axes);
  if (bounds === null) {
    return { center: [options.center.lng, options.center.lat], zoom: options.zoom };
  }
  return {
    bounds: [bounds.west, bounds.south, bounds.east, bounds.north],
    fitBoundsOptions: { padding: FIT_PADDING, maxZoom: FIT_MAX_ZOOM },
  };
}

function createMap(library: MapLibrary, options: AxesMapOptions): Library.Map {
  const map = new library.Map({
    container: options.container,
    style: options.styleUrl,
    ...firstView(options),
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

/** One source for every axis; within a layer, the later shapes are drawn on top. */
function addLayers(map: Library.Map, axes: readonly DrawnAxis[], look: Look): void {
  const color: Library.ExpressionSpecification = ["get", "color"];
  const isZone: Library.FilterSpecification = ["==", ["geometry-type"], "Polygon"];
  map.addSource(SOURCE_ID, { type: "geojson", data: toShapes(axes) });
  map.addLayer({
    id: "axes-zones",
    type: "fill",
    source: SOURCE_ID,
    filter: isZone,
    paint: { "fill-color": color, "fill-opacity": look.fillOpacity },
  });
  map.addLayer({
    id: "axes-zone-edges",
    type: "line",
    source: SOURCE_ID,
    filter: isZone,
    paint: { "line-color": color, "line-width": look.lineWidth },
  });
  map.addLayer({
    id: "axes-routes",
    type: "line",
    source: SOURCE_ID,
    filter: ["==", ["geometry-type"], "LineString"],
    paint: { "line-color": color, "line-width": look.lineWidth },
  });
}

function createTestMarker(library: MapLibrary, map: Library.Map): (point: GeoPoint | null) => void {
  let marker: Library.Marker | null = null;
  return (point) => {
    if (point === null) {
      marker?.remove();
      marker = null;
      return;
    }
    marker ??= new library.Marker({ element: createMarkerElement(t.markerLabel), anchor: "bottom" })
      .setLngLat([point.lng, point.lat])
      .addTo(map);
    marker.setLngLat([point.lng, point.lat]);
  };
}

function createController(library: MapLibrary, map: Library.Map): AxesMapHandle {
  const setTestPoint = createTestMarker(library, map);
  return {
    setAxes: (axes) => {
      // The shapes are computed here; the library's later processing has nothing to report.
      void map.getSource<Library.GeoJSONSource>(SOURCE_ID)?.setData(toShapes(axes));
    },
    setTestPoint,
    destroy: () => {
      map.remove();
    },
  };
}

/** Loads the library, draws the axes and resolves once the style is in. */
export async function loadAxesMap(options: AxesMapOptions): Promise<AxesMapHandle> {
  const library = await loadMapLibrary();
  const look = readLook(options.container);
  const map = createMap(library, options);
  // Registered before the wait below: the shapes are there when the map is handed over.
  map.once("load", () => {
    addLayers(map, options.axes, look);
  });
  map.on("click", (event) => {
    options.onPick({ lat: event.lngLat.lat, lng: event.lngLat.lng });
  });
  return whenMapLoaded(map, createController(library, map));
}
