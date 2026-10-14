import type { GeoPoint } from "@entana/contracts";
import type * as Library from "maplibre-gl";

import { texts } from "../../../i18n/texts";
import { loadMapLibrary, whenMapLoaded } from "../../../map/load-maplibre";
import type { MapLibrary } from "../../../map/load-maplibre";
import { boundsOf, toShapes } from "../rules/axes-drawing";
import { toOtherZones } from "../rules/axis-editor-drawing";
import type { AxisDrawing } from "../rules/axis-editor-drawing";

import { createAxisMarkerElement } from "./axis-marker-element";

// The only file of the axis editor that names the library. It is reached through dynamic imports
// only, so that the library, its style sheet and its worker stay one separate chunk.

export interface AxisEditorMapOptions {
  readonly container: HTMLElement;
  readonly styleUrl: string;
  /** The view of the shop, used when the axis has no place. */
  readonly center: GeoPoint;
  readonly zoom: number;
  readonly drawing: AxisDrawing;
}

export interface AxisEditorMapHandle {
  /** Draws the axis again: a new colour, a place added, removed or moved. */
  readonly setDrawing: (drawing: AxisDrawing) => void;
  readonly destroy: () => void;
}

const t = texts.settings.axisEditor.map;

const AXIS_SOURCE = "axis";
const OTHERS_SOURCE = "other-places";
const FIT_PADDING = 48;
const FIT_MAX_ZOOM = 14;

const MAP_LOCALE = {
  "Map.Title": t.label,
  "NavigationControl.ZoomIn": texts.settings.map.zoomIn,
  "NavigationControl.ZoomOut": texts.settings.map.zoomOut,
  "AttributionControl.ToggleAttribution": texts.settings.map.toggleAttribution,
};

interface Look {
  readonly fillOpacity: number;
  readonly lineWidth: number;
  readonly otherColor: string;
  readonly otherDash: number[];
}

/** The colours, widths and dashes come from the design tokens, so that a theme changes the map. */
function readLook(container: HTMLElement): Look {
  const style = getComputedStyle(container);
  const token = (name: string): string => style.getPropertyValue(name).trim();
  return {
    fillOpacity: Number.parseFloat(token("--map-zone-fill-opacity")),
    lineWidth: Number.parseFloat(token("--map-zone-line-width")),
    otherColor: token("--map-place-other-color"),
    otherDash: token("--map-place-other-dash").split(/\s+/).map(Number),
  };
}

const asAxis = (
  drawing: AxisDrawing,
): { id: string; color: string; places: AxisDrawing["places"] } => ({
  id: AXIS_SOURCE,
  color: drawing.color,
  places: drawing.places,
});

function firstView(options: AxisEditorMapOptions): Partial<Library.MapOptions> {
  const bounds = boundsOf([asAxis(options.drawing)]);
  if (bounds === null) {
    return { center: [options.center.lng, options.center.lat], zoom: options.zoom };
  }
  return {
    bounds: [bounds.west, bounds.south, bounds.east, bounds.north],
    fitBoundsOptions: { padding: FIT_PADDING, maxZoom: FIT_MAX_ZOOM },
  };
}

function createMap(library: MapLibrary, options: AxisEditorMapOptions): Library.Map {
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

/** The other places under the axis, so that the axis is always readable on top of them. */
function addLayers(map: Library.Map, drawing: AxisDrawing, look: Look): void {
  const color: Library.ExpressionSpecification = ["get", "color"];
  const isZone: Library.FilterSpecification = ["==", ["geometry-type"], "Polygon"];
  map.addSource(OTHERS_SOURCE, { type: "geojson", data: toOtherZones(drawing.others) });
  map.addLayer({
    id: "other-place-edges",
    type: "line",
    source: OTHERS_SOURCE,
    paint: {
      "line-color": look.otherColor,
      "line-width": look.lineWidth,
      "line-dasharray": look.otherDash,
    },
  });
  map.addSource(AXIS_SOURCE, { type: "geojson", data: toShapes([asAxis(drawing)]) });
  map.addLayer({
    id: "axis-zones",
    type: "fill",
    source: AXIS_SOURCE,
    filter: isZone,
    paint: { "fill-color": color, "fill-opacity": look.fillOpacity },
  });
  map.addLayer({
    id: "axis-lines",
    type: "line",
    source: AXIS_SOURCE,
    paint: { "line-color": color, "line-width": look.lineWidth },
  });
}

/** The numbered markers are made again on each change: an axis holds a few dozen places at most. */
function createMarkers(library: MapLibrary, map: Library.Map): (drawing: AxisDrawing) => void {
  let markers: Library.Marker[] = [];
  return (drawing) => {
    for (const marker of markers) {
      marker.remove();
    }
    markers = drawing.places.map((place, index) =>
      new library.Marker({
        element: createAxisMarkerElement(index + 1, place.name, drawing.color),
      })
        .setLngLat([place.lng, place.lat])
        .addTo(map),
    );
  };
}

function setData(map: Library.Map, id: string, data: ReturnType<typeof toShapes>): void {
  // The shapes are computed here; the library's later processing has nothing to report.
  void map.getSource<Library.GeoJSONSource>(id)?.setData(data);
}

/** Loads the library, draws the axis and resolves once the style is in. */
export async function loadAxisEditorMap(
  options: AxisEditorMapOptions,
): Promise<AxisEditorMapHandle> {
  const library = await loadMapLibrary();
  const look = readLook(options.container);
  const map = createMap(library, options);
  const placeMarkers = createMarkers(library, map);
  map.once("load", () => {
    addLayers(map, options.drawing, look);
  });
  placeMarkers(options.drawing);
  return whenMapLoaded(map, {
    setDrawing: (drawing) => {
      setData(map, AXIS_SOURCE, toShapes([asAxis(drawing)]));
      setData(map, OTHERS_SOURCE, toOtherZones(drawing.others));
      placeMarkers(drawing);
    },
    destroy: () => {
      map.remove();
    },
  });
}
