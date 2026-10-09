import type { ProductListResponse } from "@entana/contracts";
import { useQuery } from "@tanstack/react-query";
import type { UseQueryResult } from "@tanstack/react-query";

import { fetchProducts } from "./fetch-products";

/** The catalogue request. One key, so the catalogue and the cart share one cache entry. */
export function useProducts(): UseQueryResult<ProductListResponse> {
  return useQuery({
    queryKey: ["products"],
    queryFn: ({ signal }) => fetchProducts(signal),
  });
}
