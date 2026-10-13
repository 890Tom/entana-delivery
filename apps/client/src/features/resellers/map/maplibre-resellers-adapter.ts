import type * as Library from "maplibre-gl";

import { texts } from "../../../i18n/texts";

import type {
  MapShop,
  ResellersMapAdapter,
  ResellersMapLoader,
  ResellersMapOptions,
} from "./resellers-map-adapter";
import {
  createShopMarkerElement,
  createUserDotElement,
  markShopMarkerSelected,
} from "./shop-marker-element";

// The only file of this screen that names the library. It is reached through dynamic imports
// only, so that the library, its style sheet and its worker stay one separate chunk.
type LibraryModule = typeof Library;

const MAP_LOCALE = {
  "Map.Title": texts.resellers.map.canvasLabel,
  "NavigationControl.ZoomIn": texts.resellers.map.zoomIn,
  "NavigationControl.ZoomOut": texts.resellers.map.zoomOut,
  "AttributionControl.ToggleAttribution": texts.resellers.map.toggleAttribution,
};

interface ShopMarker {
  readonly marker: Library.Marker;
  readonly element: HTMLButtonElement;
}

function createShopMarkers(
  library: LibraryModule,
  map: Library.Map,
  onSelect: ResellersMapOptions["onSelect"],
): Pick<ResellersMapAdapter, "setShops" | "setSelected"> & { readonly clear: () => void } {
  const markers = new Map<string, ShopMarker>();
  let selectedId: string | null = null;
  const add = (shop: MapShop): void => {
    const element = createShopMarkerElement(shop.name);
    element.addEventListener("click", () => {
      onSelect(shop.id);
    });
    const marker = new library.Marker({ element })
      .setLngLat([shop.point.lng, shop.point.lat])
      .addTo(map);
    markShopMarkerSelected(element, shop.id === selectedId);
    markers.set(shop.id, { marker, element });
  };
  const clear = (): void => {
    for (const { marker } of markers.values()) {
      marker.remove();
    }
    markers.clear();
  };
  return {
    clear,
    // A short list: the markers are drawn again rather than compared.
    setShops: (shops) => {
      clear();
      shops.forEach(add);
    },
    setSelected: (id) => {
      selectedId = id;
      for (const [shopId, { element }] of markers) {
        markShopMarkerSelected(element, shopId === id);
      }
    },
  };
}

function createUserDot(
  library: LibraryModule,
  map: Library.Map,
): { readonly set: ResellersMapAdapter["setUserPosition"]; readonly remove: () => void } {
  let marker: Library.Marker | null = null;
  const remove = (): void => {
    marker?.remove();
    marker = null;
  };
  const set: ResellersMapAdapter["setUserPosition"] = (point) => {
    if (point === null) {
      remove();
      return;
    }
    if (marker === null) {
      const element = createUserDotElement(texts.resellers.map.userPosition);
      marker = new library.Marker({ element }).setLngLat([point.lng, point.lat]).addTo(map);
      return;
    }
    marker.setLngLat([point.lng, point.lat]);
  };
  return { set, remove };
}

function createAdapter(library: LibraryModule, map: Library.Map, options: ResellersMapOptions) {
  const shops = createShopMarkers(library, map, options.onSelect);
  const userDot = createUserDot(library, map);
  return {
    setShops: shops.setShops,
    setSelected: shops.setSelected,
    setUserPosition: userDot.set,
    centreOn: (point) => {
      const view = { center: [point.lng, point.lat] as [number, number] };
      // No animation when the system asks for less motion.
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        map.jumpTo(view);
        return;
      }
      map.easeTo(view);
    },
    destroy: () => {
      shops.clear();
      userDot.remove();
      map.remove();
    },
  } satisfies ResellersMapAdapter;
}

function createMap(library: LibraryModule, options: ResellersMapOptions): Library.Map {
  const map = new library.Map({
    container: options.container,
    style: options.styleUrl,
    center: [options.center.lng, options.center.lat],
    zoom: options.zoom,
    // The credits come from the style and stay open: behind a button they would not be readable.
    attributionControl: { compact: false },
    locale: MAP_LOCALE,
    dragRotate: false,
    touchPitch: false,
  });
  map.touchZoomRotate.disableRotation();
  map.keyboard.disableRotation();
  // Zoom buttons only, no compass.
  map.addControl(new library.NavigationControl({ showCompass: false }), "top-left");
  return map;
}

/** Loads the library, creates the map, and resolves when its style has loaded. */
export const loadMapLibreResellersAdapter: ResellersMapLoader = async (options) => {
  const [library, worker] = await Promise.all([
    import("maplibre-gl"),
    import("maplibre-gl/dist/maplibre-gl-worker.mjs?url"),
    import("maplibre-gl/dist/maplibre-gl.css"),
  ]);
  // The worker is a file of the application (same origin), not a blob: a strict policy allows it.
  library.setWorkerUrl(worker.default);
  const map = createMap(library, options);
  return new Promise<ResellersMapAdapter>((resolve, reject) => {
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
