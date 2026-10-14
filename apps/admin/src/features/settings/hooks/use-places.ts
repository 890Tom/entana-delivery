import type { AdminDeliveryPlace } from "@entana/contracts";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { fetchPlaces } from "../api/axes-calls";

const PLACES_KEY = ["admin-delivery-places"] as const;

export interface PlacesModel {
  /** The active places, by name; undefined until they are loaded. */
  readonly places: readonly AdminDeliveryPlace[] | undefined;
  readonly hasFailed: boolean;
  readonly reload: () => void;
}

/** The active places of the shop: what an axis can take. */
export function usePlaces(): PlacesModel {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: PLACES_KEY, queryFn: ({ signal }) => fetchPlaces(signal) });
  return {
    places: query.data?.places,
    hasFailed: query.isError,
    reload: () => {
      void queryClient.invalidateQueries({ queryKey: PLACES_KEY });
    },
  };
}
