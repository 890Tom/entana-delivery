import type { PublicReseller, ResellerListResponse } from "@entana/contracts";
import type { UseQueryResult } from "@tanstack/react-query";
import type { ReactElement } from "react";
import { useMemo, useRef, useState } from "react";

import { texts } from "../../i18n/texts";
import { useDocumentTitle } from "../../layout/document-title/use-document-title";
import type { GeoPoint } from "../delivery/map/map-adapter";
import { useInstance } from "../instance/api/use-instance";

import { useResellers } from "./api/use-resellers";
import type { MapShop } from "./map/resellers-map-adapter";
import { useResellersMap } from "./map/use-resellers-map";
import { ResellersListPanel } from "./resellers-list-panel";
import type { ListState } from "./resellers-list-panel";
import { ResellersMapPanel } from "./resellers-map-panel";
import styles from "./resellers-screen.module.css";
import { filterByNeighborhood } from "./rules/filter-by-neighborhood";
import { toShopEntries } from "./rules/sort-by-distance";
import type { ShopEntry } from "./rules/sort-by-distance";
import { useMapSync } from "./use-map-sync";
import { useNearbyPosition } from "./use-nearby-position";
import { useShopSelection } from "./use-shop-selection";

function toMapShops(entries: readonly ShopEntry[]): readonly MapShop[] {
  return entries.map(({ reseller }) => ({
    id: reseller.id,
    name: reseller.name,
    point: { lat: reseller.latitude, lng: reseller.longitude },
  }));
}

function toListState(query: UseQueryResult<ResellerListResponse>): ListState {
  if (query.isPending) {
    return { status: "loading" };
  }
  if (query.isError) {
    return {
      status: "failed",
      error: query.error,
      onRetry: () => {
        void query.refetch();
      },
    };
  }
  return { status: "ready", isEmpty: query.data.resellers.length === 0 };
}

/** The resellers that pass the filter, sorted from the customer's position when it is known. */
function useVisibleShops(
  resellers: readonly PublicReseller[] | undefined,
  neighborhood: string,
  origin: GeoPoint | null,
): { readonly entries: readonly ShopEntry[]; readonly shops: readonly MapShop[] } {
  return useMemo(() => {
    const entries = toShopEntries(filterByNeighborhood(resellers ?? [], neighborhood), origin);
    return { entries, shops: toMapShops(entries) };
  }, [resellers, neighborhood, origin]);
}

/** "Où nous trouver": the resellers in a list and on a map, filtered by neighborhood. */
export function ResellersScreen(): ReactElement {
  useDocumentTitle(texts.resellers.title);
  const query = useResellers();
  const instance = useInstance();
  const nearby = useNearbyPosition();
  const [neighborhood, setNeighborhood] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  const { entries, shops } = useVisibleShops(query.data?.resellers, neighborhood, nearby.point);
  const { selection, selectedId, selectFromList, selectFromMap } = useShopSelection(shops);

  const map = useResellersMap(containerRef, instance.data?.map, selectFromMap);
  const adapter = map.state.status === "ready" ? map.state.adapter : null;
  useMapSync(adapter, { shops, selectedId, selection, userPoint: nearby.point });

  return (
    <div className={styles.page}>
      <div className={styles.panel}>
        <ResellersListPanel
          list={toListState(query)}
          entries={entries}
          neighborhood={neighborhood}
          onNeighborhoodChange={setNeighborhood}
          nearby={nearby}
          selectedId={selectedId}
          revealedId={selection?.source === "map" ? selectedId : null}
          onSelect={selectFromList}
        />
      </div>
      <div className={styles.map}>
        <ResellersMapPanel
          containerRef={containerRef}
          status={instance.isError ? "failed" : map.state.status}
          onRetry={() => {
            void instance.refetch();
            map.retry();
          }}
        />
      </div>
    </div>
  );
}
