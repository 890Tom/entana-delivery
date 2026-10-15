import type { AdminReseller } from "@entana/contracts";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { fetchResellers } from "./reseller-calls";

const RESELLERS_KEY = ["admin-resellers"] as const;

export interface ResellersModel {
  /** Undefined until the list is loaded. */
  readonly resellers: readonly AdminReseller[] | undefined;
  readonly hasFailed: boolean;
  readonly retry: () => void;
}

/** The resellers of the shop: one list, held in the query cache, in the order of the API. */
export function useResellers(): ResellersModel {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: RESELLERS_KEY,
    queryFn: ({ signal }) => fetchResellers(signal),
  });
  return {
    resellers: query.data?.resellers,
    hasFailed: query.isError,
    retry: () => {
      void queryClient.invalidateQueries({ queryKey: RESELLERS_KEY });
    },
  };
}

export interface ResellersCache {
  /** Puts the server's version of a reseller in the list held in memory, at its place. */
  readonly replace: (reseller: AdminReseller) => void;
  /** Drops a reseller from the list held in memory. */
  readonly remove: (resellerId: string) => void;
  /** Marks the list as old: it is read again, in the order of the API, when a screen needs it. */
  readonly invalidate: () => void;
}

type Cached = { resellers: AdminReseller[] } | undefined;

/** The list held in memory, for a screen that edits one reseller or creates a new one. */
export function useResellersCache(): ResellersCache {
  const queryClient = useQueryClient();
  const change = (update: (current: AdminReseller[]) => AdminReseller[]): void => {
    queryClient.setQueryData(RESELLERS_KEY, (current: Cached) =>
      current === undefined ? current : { resellers: update(current.resellers) },
    );
  };
  return {
    replace: (reseller) => {
      change((current) => current.map((item) => (item.id === reseller.id ? reseller : item)));
    },
    remove: (resellerId) => {
      change((current) => current.filter((item) => item.id !== resellerId));
    },
    invalidate: () => {
      void queryClient.invalidateQueries({ queryKey: RESELLERS_KEY });
    },
  };
}
