import type { AdminProduct } from "@entana/contracts";

export const CATALOGUE_TABS = ["all", "available", "unavailable", "retired"] as const;

export type CatalogueTab = (typeof CATALOGUE_TABS)[number];

export interface CatalogueCounts {
  readonly active: number;
  readonly unavailable: number;
  readonly retired: number;
}

function isInTab(product: AdminProduct, tab: CatalogueTab): boolean {
  switch (tab) {
    case "all":
      return !product.retired;
    case "available":
      return !product.retired && product.available;
    case "unavailable":
      return !product.retired && !product.available;
    case "retired":
      return product.retired;
  }
}

/** Lower case, without accents: "Crème" is found by "creme". */
function normalise(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

function matches(product: AdminProduct, term: string): boolean {
  return normalise(product.name).includes(term) || normalise(product.sku).includes(term);
}

/** The products of a tab that match the search, in the order they were given. */
export function visibleProducts(
  products: readonly AdminProduct[],
  tab: CatalogueTab,
  search: string,
): readonly AdminProduct[] {
  const term = normalise(search.trim());
  return products.filter((product) => isInTab(product, tab) && matches(product, term));
}

/** The counters are computed on the whole list, whatever the tab or the search. */
export function countProducts(products: readonly AdminProduct[]): CatalogueCounts {
  return {
    active: products.filter((product) => isInTab(product, "all")).length,
    unavailable: products.filter((product) => isInTab(product, "unavailable")).length,
    retired: products.filter((product) => isInTab(product, "retired")).length,
  };
}

/** The order is that of the whole active list: with a filter or a search a move means nothing. */
export function canReorder(tab: CatalogueTab, search: string): boolean {
  return tab === "all" && search.trim() === "";
}
