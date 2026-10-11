import { isFinalStatus } from "@entana/contracts";
import type { TrackingResponse } from "@entana/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Query, UseMutationResult, UseQueryResult } from "@tanstack/react-query";
import { useEffect } from "react";

import {
  cancelTracking,
  fetchTracking,
  TrackingConflictError,
  TrackingNotFoundError,
  TrackingRequestError,
} from "./request-tracking";

/** How often an order that is not finished is read again, while the tab is visible. */
export const TRACKING_REFRESH_INTERVAL_MS = 30_000;
/** Network and server failures are tried again this many times, then shown. */
const MAX_RETRIES = 2;

// The token is not part of the key: it only lives in the closure of the request. The cache is
// emptied with the screen, so that it never shows the order of another token.
const TRACKING_KEY = ["tracking"] as const;

type TrackingQuery = Query<TrackingResponse, Error, TrackingResponse, typeof TRACKING_KEY>;

/** An order that is finished, or that the server no longer knows, is not read again. */
function isStillWatched(query: TrackingQuery): boolean {
  const data = query.state.data;
  if (data !== undefined && isFinalStatus(data.status)) {
    return false;
  }
  return !(query.state.error instanceof TrackingNotFoundError);
}

export function useTracking(token: string | null): UseQueryResult<TrackingResponse> {
  const client = useQueryClient();
  useEffect(
    () => () => {
      client.removeQueries({ queryKey: TRACKING_KEY });
    },
    [client],
  );
  return useQuery({
    queryKey: TRACKING_KEY,
    queryFn: ({ signal }) =>
      token === null ? Promise.reject(new Error("No token")) : fetchTracking(token, signal),
    enabled: token !== null,
    gcTime: 0,
    // Neither an unknown order nor a finished one is asked for again, by time, focus or network.
    refetchInterval: (query) => (isStillWatched(query) ? TRACKING_REFRESH_INTERVAL_MS : false),
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: (query) => isStillWatched(query),
    refetchOnReconnect: (query) => isStillWatched(query),
    // A limit is not made worse by trying again at once; an unknown order does not become known.
    retry: (failureCount, error) =>
      !(error instanceof TrackingNotFoundError) &&
      !(error instanceof TrackingRequestError && error.kind === "rate_limited") &&
      failureCount < MAX_RETRIES,
  });
}

/** The answer replaces the view; a conflict makes the view read again. */
export function useCancelTracking(token: string | null): UseMutationResult<TrackingResponse> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () =>
      token === null ? Promise.reject(new Error("No token")) : cancelTracking(token),
    onSuccess: async (view) => {
      // A reading still on its way would otherwise overwrite the answer with the older view.
      await client.cancelQueries({ queryKey: TRACKING_KEY });
      client.setQueryData(TRACKING_KEY, view);
    },
    // The order has moved on, or is gone, without the customer: the view is read again to show it.
    onError: (error) => {
      if (error instanceof TrackingConflictError || error instanceof TrackingNotFoundError) {
        void client.invalidateQueries({ queryKey: TRACKING_KEY });
      }
    },
  });
}
