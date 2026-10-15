import type { AdminDeliveryAxis } from "@entana/contracts";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { fetchAxes } from "./axes-calls";

const AXES_KEY = ["admin-delivery-axes"] as const;

export interface AxesModel {
  /** Every axis in priority order, inactive ones included; undefined until it is loaded. */
  readonly axes: readonly AdminDeliveryAxis[] | undefined;
  readonly hasFailed: boolean;
  /** Reads the list again: after a failed read, or when the server is the truth after a refusal. */
  readonly reload: () => void;
  /** Rewrites the list held in memory (a local move, its undoing, or the answer of the server). */
  readonly replace: (axes: readonly AdminDeliveryAxis[]) => void;
}

/** The delivery axes of the shop: one list, held in the query cache. */
export function useAxes(): AxesModel {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: AXES_KEY,
    queryFn: ({ signal }) => fetchAxes(signal),
    // A move in progress must not be replaced by a read made because the tab got the focus.
    refetchOnWindowFocus: false,
  });
  return {
    axes: query.data?.axes,
    hasFailed: query.isError,
    reload: () => {
      void queryClient.invalidateQueries({ queryKey: AXES_KEY });
    },
    replace: (axes) => {
      queryClient.setQueryData(AXES_KEY, { axes: [...axes] });
    },
  };
}
