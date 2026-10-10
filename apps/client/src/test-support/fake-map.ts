import { vi } from "vitest";
import type { Mock } from "vitest";

import type {
  GeoPoint,
  MapAdapter,
  MapAdapterOptions,
  MapLoader,
} from "../features/delivery/map/map-adapter";

/** A map that records what the screen asks of it. No WebGL: the real library is not run in tests. */
export interface FakeMap {
  readonly options: MapAdapterOptions;
  /** Every marker position set, in order; null is a removal. */
  readonly markers: (GeoPoint | null)[];
  readonly centrings: { readonly point: GeoPoint; readonly zoom: number }[];
  center: GeoPoint;
  isDestroyed: boolean;
  /** The user taps the map (or drops the marker) at this point. */
  readonly pick: (point: GeoPoint) => void;
}

interface PendingLoad {
  readonly options: MapAdapterOptions;
  readonly succeed: () => FakeMap;
  readonly fail: () => void;
}

/** A loader that stays pending until the test settles it, like a real network load. */
export interface FakeMapLoader {
  readonly loader: Mock<MapLoader>;
  readonly maps: FakeMap[];
  /** Settles the oldest pending load: the map is ready. */
  readonly succeed: () => FakeMap;
  /** Settles the oldest pending load: the library or the style could not be loaded. */
  readonly fail: () => void;
}

function buildFakeMap(options: MapAdapterOptions): { map: FakeMap; adapter: MapAdapter } {
  const map: FakeMap = {
    options,
    markers: [],
    centrings: [],
    center: options.center,
    isDestroyed: false,
    pick: (point) => {
      options.onPick(point);
    },
  };
  const adapter: MapAdapter = {
    setMarker: (point) => {
      map.markers.push(point);
    },
    centreOn: (point, zoom) => {
      map.centrings.push({ point, zoom });
    },
    getCenter: () => map.center,
    destroy: () => {
      map.isDestroyed = true;
    },
  };
  return { map, adapter };
}

export function createFakeMapLoader(): FakeMapLoader {
  const pending: PendingLoad[] = [];
  const maps: FakeMap[] = [];
  const loader = vi.fn<MapLoader>(
    (options) =>
      new Promise<MapAdapter>((resolve, reject) => {
        const { map, adapter } = buildFakeMap(options);
        pending.push({
          options,
          succeed: () => {
            maps.push(map);
            resolve(adapter);
            return map;
          },
          fail: () => {
            reject(new Error("map unavailable"));
          },
        });
      }),
  );
  const next = (): PendingLoad => {
    const load = pending.shift();
    if (load === undefined) {
      throw new Error("No map load is pending");
    }
    return load;
  };
  return {
    loader,
    maps,
    succeed: () => next().succeed(),
    fail: () => {
      next().fail();
    },
  };
}
