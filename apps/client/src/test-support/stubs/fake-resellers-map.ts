import { vi } from "vitest";
import type { Mock } from "vitest";

import type { GeoPoint } from "../../features/delivery/map/map-adapter";
import type {
  MapShop,
  ResellersMapAdapter,
  ResellersMapLoader,
  ResellersMapOptions,
} from "../../features/resellers/map/resellers-map-adapter";

/** The map of the resellers, as the screen drove it. No WebGL: the library is not run in tests. */
export interface FakeResellersMap {
  readonly options: ResellersMapOptions;
  /** The markers shown now. */
  shops: readonly MapShop[];
  selectedId: string | null;
  userPosition: GeoPoint | null;
  readonly centrings: GeoPoint[];
  isDestroyed: boolean;
  /** The user activates the marker of this reseller. */
  readonly clickMarker: (id: string) => void;
}

export interface FakeResellersMapLoader {
  readonly loader: Mock<ResellersMapLoader>;
  /** Settles the oldest pending load: the map is ready. */
  readonly succeed: () => FakeResellersMap;
  /** Settles the oldest pending load: the library or the style could not be loaded. */
  readonly fail: () => void;
}

interface PendingLoad {
  readonly succeed: () => FakeResellersMap;
  readonly fail: () => void;
}

function buildFake(options: ResellersMapOptions): {
  map: FakeResellersMap;
  adapter: ResellersMapAdapter;
} {
  const map: FakeResellersMap = {
    options,
    shops: [],
    selectedId: null,
    userPosition: null,
    centrings: [],
    isDestroyed: false,
    clickMarker: (id) => {
      options.onSelect(id);
    },
  };
  const adapter: ResellersMapAdapter = {
    setShops: (shops) => {
      map.shops = shops;
    },
    setSelected: (id) => {
      map.selectedId = id;
    },
    setUserPosition: (point) => {
      map.userPosition = point;
    },
    centreOn: (point) => {
      map.centrings.push(point);
    },
    destroy: () => {
      map.isDestroyed = true;
    },
  };
  return { map, adapter };
}

/** A loader that stays pending until the test settles it, like a real network load. */
export function createFakeResellersMapLoader(): FakeResellersMapLoader {
  const pending: PendingLoad[] = [];
  const loader = vi.fn<ResellersMapLoader>(
    (options) =>
      new Promise<ResellersMapAdapter>((resolve, reject) => {
        const { map, adapter } = buildFake(options);
        pending.push({
          succeed: () => {
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
    succeed: () => next().succeed(),
    fail: () => {
      next().fail();
    },
  };
}
