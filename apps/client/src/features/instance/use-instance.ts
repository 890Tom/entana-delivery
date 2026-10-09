import type { PublicInstance } from "@entana/contracts";
import { useQuery } from "@tanstack/react-query";
import type { UseQueryResult } from "@tanstack/react-query";

import { fetchInstance } from "./api/fetch-instance";

/** The configuration does not change while the app is open: it is asked for once, at start. */
export function useInstance(): UseQueryResult<PublicInstance> {
  return useQuery({
    queryKey: ["instance"],
    queryFn: ({ signal }) => fetchInstance(signal),
    staleTime: Infinity,
  });
}

/** The name to show: null while the instance loads, a generic one when it cannot be loaded. */
export function useShopName(fallback: string): string | null {
  const instance = useInstance();
  if (instance.isPending) {
    return null;
  }
  return instance.isError ? fallback : instance.data.name;
}
