import type { DeliveryQuoteRequest, DeliveryQuoteResponse } from "@entana/contracts";
import { skipToken, useQuery } from "@tanstack/react-query";
import type { UseQueryResult } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";

import { fetchDeliveryQuote } from "../api/fetch-delivery-quote";
import type { GeoPoint } from "../map/map-adapter";

import { retainDeliveryQuote } from "./retained-quote";
import { useDebouncedValue } from "./use-debounced-value";

/** The wait after the last move of the point, so that a drag asks once, not at every step. */
const QUOTE_DELAY_MS = 300;

/** The fee of the point and the pieces as they are now: none without a point. */
export type DeliveryQuoteState =
  | { readonly status: "none" }
  | { readonly status: "loading" }
  | { readonly status: "failed"; readonly onRetry: () => void }
  | { readonly status: "ready"; readonly quote: DeliveryQuoteResponse };

function useQuoteQuery(
  request: DeliveryQuoteRequest | null,
): UseQueryResult<DeliveryQuoteResponse> {
  return useQuery({
    // In the memory of the query cache only, and dropped as soon as no screen reads it.
    queryKey: ["delivery-quote", request],
    // The signal is used: a request for an older point is cancelled when a newer one replaces it.
    queryFn: request === null ? skipToken : ({ signal }) => fetchDeliveryQuote(request, signal),
    gcTime: 0,
  });
}

/**
 * Asks the server what the delivery of this point and this number of pieces costs, 300 ms after
 * the last change. Only the answer for the values of now is shown; a success is retained for the
 * next screens of the order. The point lives in memory: never in an address, never logged.
 */
export function useDeliveryQuote(point: GeoPoint | null, pieces: number): DeliveryQuoteState {
  const request = useMemo<DeliveryQuoteRequest | null>(
    () => (point === null ? null : { latitude: point.lat, longitude: point.lng, pieces }),
    [point, pieces],
  );
  const settled = useDebouncedValue(request, QUOTE_DELAY_MS);
  const query = useQuoteQuery(settled);
  const isCurrent = settled === request;
  const quote = isCurrent && query.isSuccess ? query.data : null;

  useEffect(() => {
    if (point !== null && quote !== null) {
      retainDeliveryQuote({ point, pieces, quote });
    }
  }, [point, pieces, quote]);

  if (request === null) {
    return { status: "none" };
  }
  if (quote !== null) {
    return { status: "ready", quote };
  }
  if (!isCurrent || !query.isError || query.isFetching) {
    return { status: "loading" };
  }
  return {
    status: "failed",
    onRetry: () => {
      void query.refetch();
    },
  };
}
