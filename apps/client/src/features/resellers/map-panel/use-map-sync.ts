import { useEffect } from "react";

import type { GeoPoint } from "../../delivery/map/map-adapter";

import type { MapShop, ResellersMapAdapter } from "../map/resellers-map-adapter";
import type { Selection } from "../selection/use-shop-selection";

interface MapSyncState {
  readonly shops: readonly MapShop[];
  readonly selectedId: string | null;
  readonly selection: Selection | null;
  /** The position of the device: drawn and centred on, nothing else. */
  readonly userPoint: GeoPoint | null;
}

/** Brings the map (when it is ready) to what the screen shows. The screen is the source. */
export function useMapSync(adapter: ResellersMapAdapter | null, state: MapSyncState): void {
  const { shops, selectedId, selection, userPoint } = state;
  useEffect(() => {
    adapter?.setShops(shops);
    adapter?.setSelected(selectedId);
  }, [adapter, shops, selectedId]);
  useEffect(() => {
    adapter?.setUserPosition(userPoint);
    if (userPoint !== null) {
      adapter?.centreOn(userPoint);
    }
  }, [adapter, userPoint]);
  useEffect(() => {
    if (selection !== null) {
      adapter?.centreOn(selection.point);
    }
  }, [adapter, selection]);
}
