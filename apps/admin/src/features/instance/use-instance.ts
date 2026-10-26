import { publicInstanceSchema } from "@entana/contracts";
import type { PublicInstance } from "@entana/contracts";
import { useQuery } from "@tanstack/react-query";
import type { UseQueryResult } from "@tanstack/react-query";

import { fetchAdmin } from "../../data-fetching/fetch-admin";
import { AdminRequestError } from "../../data-fetching/admin-request-error";

import { applyInstanceTheme } from "./theme/apply-instance-theme";

/**
 * The name, the logo and the theme of the shop: public, and unchanged while the page is open. The
 * theme is applied inside the request, before the answer reaches any component: the maps read the
 * colours once, when they are created.
 */
export function useInstance(): UseQueryResult<PublicInstance> {
  return useQuery({
    queryKey: ["instance"],
    queryFn: async ({ signal }) => {
      const result = await fetchAdmin({ path: "/api/v1/instance", signal }, publicInstanceSchema);
      if (result.kind !== "ok") {
        throw new AdminRequestError(result.kind);
      }
      applyInstanceTheme(result.data.theme);
      return result.data;
    },
    staleTime: Infinity,
  });
}

/** The name to show: null while it loads or when it cannot be loaded. */
export function useShopName(): string | null {
  const instance = useInstance();
  return instance.data?.name ?? null;
}
