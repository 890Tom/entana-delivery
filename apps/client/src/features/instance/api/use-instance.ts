import type { PublicInstance } from "@entana/contracts";
import { useQuery } from "@tanstack/react-query";
import type { UseQueryResult } from "@tanstack/react-query";

import { applyInstanceTheme } from "../theme/apply-instance-theme";

import { fetchInstance } from "./fetch-instance";

/**
 * The configuration does not change while the app is open: it is asked for once, at start. The
 * theme is applied inside the request, before the answer reaches any component: the maps read the
 * colours once, when they are created.
 */
export function useInstance(): UseQueryResult<PublicInstance> {
  return useQuery({
    queryKey: ["instance"],
    queryFn: async ({ signal }) => {
      const instance = await fetchInstance(signal);
      applyInstanceTheme(instance.theme);
      return instance;
    },
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
