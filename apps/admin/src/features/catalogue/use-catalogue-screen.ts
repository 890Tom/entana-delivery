import type { AdminProduct } from "@entana/contracts";
import { useState } from "react";

import type { RowActions } from "./product-table/product-row";
import { canReorder, countProducts, visibleProducts } from "./rules/catalogue-view";
import type { CatalogueCounts, CatalogueTab } from "./rules/catalogue-view";

import { useCatalogueNotice } from "./notice/use-catalogue-notice";
import type { CatalogueNotice } from "./notice/use-catalogue-notice";
import { useProductActions } from "./product-actions/use-product-actions";
import { useProductOrder } from "./product-table/use-product-order";
import { useProducts } from "./api/use-products";

export interface CatalogueScreenModel {
  readonly status: "loading" | "failed" | "ready";
  readonly retry: () => void;
  readonly counts: CatalogueCounts;
  readonly tab: CatalogueTab;
  readonly search: string;
  readonly visible: readonly AdminProduct[];
  readonly hasProducts: boolean;
  readonly canReorder: boolean;
  readonly notice: CatalogueNotice | null;
  readonly selectTab: (tab: CatalogueTab) => void;
  readonly setSearch: (text: string) => void;
  readonly actionsOf: (product: AdminProduct) => RowActions;
  readonly move: (ids: readonly string[]) => void;
}

const NO_PRODUCTS: readonly AdminProduct[] = [];

/** The state of the screen: the list, the tab and search, and what each action does. */
export function useCatalogueScreen(): CatalogueScreenModel {
  const model = useProducts();
  const notices = useCatalogueNotice();
  const actions = useProductActions(model, notices);
  const move = useProductOrder(model, notices);
  const [tab, setTab] = useState<CatalogueTab>("all");
  const [search, setSearch] = useState("");
  const products = model.products ?? NO_PRODUCTS;

  const status = model.products !== undefined ? "ready" : model.hasFailed ? "failed" : "loading";
  return {
    status,
    retry: model.retry,
    counts: countProducts(products),
    tab,
    search,
    visible: visibleProducts(products, tab, search),
    hasProducts: products.length > 0,
    canReorder: canReorder(tab, search),
    notice: notices.notice,
    selectTab: (next) => {
      notices.clear();
      setTab(next);
    },
    setSearch,
    actionsOf: (product) => ({
      isPending: actions.pendingIds.has(product.id),
      onToggle: () => {
        void actions.toggleAvailability(product);
      },
      onRetire: () => actions.retire(product),
      onRestore: () => actions.restore(product),
    }),
    move,
  };
}
