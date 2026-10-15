import { useState } from "react";

import type { GeoPoint } from "../../delivery/map/map-adapter";

import type { MapShop } from "../map/resellers-map-adapter";

/** The reseller chosen, where it is, and whether the choice came from the map. */
export interface Selection {
  readonly id: string;
  readonly point: GeoPoint;
  readonly source: "list" | "map";
}

export interface ShopSelection {
  readonly selection: Selection | null;
  /** The chosen reseller if it is still shown (a filter may have removed it). */
  readonly selectedId: string | null;
  /** A card was chosen: choosing the same card again lets go of it. */
  readonly selectFromList: (id: string) => void;
  /** A marker was activated: the reseller is selected. */
  readonly selectFromMap: (id: string) => void;
}

/** Which reseller is highlighted in the list and on the map: one state for both. */
export function useShopSelection(shops: readonly MapShop[]): ShopSelection {
  const [selection, setSelection] = useState<Selection | null>(null);
  const selectedId =
    selection !== null && shops.some((shop) => shop.id === selection.id) ? selection.id : null;

  const choose = (id: string, source: Selection["source"]): void => {
    const shop = shops.find((candidate) => candidate.id === id);
    if (shop === undefined) {
      return;
    }
    setSelection((current) =>
      source === "list" && current?.id === id ? null : { id, point: shop.point, source },
    );
  };
  return {
    selection,
    selectedId,
    selectFromList: (id) => {
      choose(id, "list");
    },
    selectFromMap: (id) => {
      choose(id, "map");
    },
  };
}
