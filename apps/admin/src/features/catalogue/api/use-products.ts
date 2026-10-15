import type { AdminProduct } from "@entana/contracts";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { fetchProducts } from "./catalogue-calls";
import { upsertProduct } from "../rules/product-list";

const PRODUCTS_KEY = ["admin-products"] as const;

export interface ProductsModel {
  /** The whole catalogue, retired products included; undefined until it is loaded. */
  readonly products: readonly AdminProduct[] | undefined;
  readonly isPending: boolean;
  readonly hasFailed: boolean;
  readonly retry: () => void;
  /** Rewrites the list held in memory (a local move, or the answer of the server). */
  readonly update: (change: (products: readonly AdminProduct[]) => readonly AdminProduct[]) => void;
  /** Reads the list again: the server is the truth after a refusal. */
  readonly reload: () => void;
}

/** The catalogue of the shop: one list, held in the query cache, edited from the server's answers. */
export function useProducts(): ProductsModel {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: PRODUCTS_KEY,
    queryFn: ({ signal }) => fetchProducts(signal),
    // A reorder in progress must not be replaced by a read made because the tab got the focus.
    refetchOnWindowFocus: false,
  });
  const reload = (): void => {
    void queryClient.invalidateQueries({ queryKey: PRODUCTS_KEY });
  };
  return {
    products: query.data?.products,
    isPending: query.isPending,
    hasFailed: query.isError,
    retry: reload,
    update: (change) => {
      queryClient.setQueryData(PRODUCTS_KEY, (current: { products: AdminProduct[] } | undefined) =>
        current === undefined ? current : { products: [...change(current.products)] },
      );
    },
    reload,
  };
}

export interface ProductsCache {
  /** Puts the server's version of a product in the list held in memory, if the list is held. */
  readonly upsert: (product: AdminProduct) => void;
  /** Marks the list as old: it is read again the next time a screen needs it. */
  readonly invalidate: () => void;
}

/** The list held in memory, for a screen that does not read it (the form of a new product). */
export function useProductsCache(): ProductsCache {
  const queryClient = useQueryClient();
  return {
    upsert: (product) => {
      queryClient.setQueryData(PRODUCTS_KEY, (current: { products: AdminProduct[] } | undefined) =>
        current === undefined
          ? current
          : { products: [...upsertProduct(current.products, product)] },
      );
    },
    invalidate: () => {
      void queryClient.invalidateQueries({ queryKey: PRODUCTS_KEY });
    },
  };
}
