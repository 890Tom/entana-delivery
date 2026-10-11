import { isFinalStatus } from "@entana/contracts";
import { useQuery } from "@tanstack/react-query";
import type { UseQueryResult } from "@tanstack/react-query";
import { useState } from "react";

import {
  readConfirmedOrders,
  removeConfirmedOrder,
} from "../../order-submission/storage/confirmed-orders-storage";
import type { ConfirmedOrder } from "../../order-submission/storage/confirmed-orders-storage";
import { TrackingNotFoundError, fetchTracking } from "../../tracking/api/request-tracking";

/** How long the answer is kept: one check per visit, not a poll. */
const ACTIVE_ORDER_CACHE_MS = 30_000;

export interface ActiveOrder {
  readonly isActive: boolean;
}

/**
 * The most recent order of the device, read once when the screen opens. It is not read again
 * when that order turns out to be unknown: the next one is never tried in its place.
 */
export function useLatestOrder(): ConfirmedOrder | null {
  const [order] = useState(() => readConfirmedOrders(Date.now())[0] ?? null);
  return order;
}

/**
 * Whether the latest order is still going on: one reading of its tracking, with the token in the
 * header only. The key holds the order code (not a secret) so that a newer order is never
 * answered by the cache of an older one, and never the token. An order that the server does not
 * know is forgotten.
 */
export function useActiveOrder(order: ConfirmedOrder | null): UseQueryResult<ActiveOrder> {
  return useQuery({
    queryKey: ["active-order", order?.code],
    queryFn: async ({ signal }) => {
      if (order === null) {
        throw new Error("No order to check");
      }
      try {
        const view = await fetchTracking(order.token, signal);
        return { isActive: !isFinalStatus(view.status) };
      } catch (error: unknown) {
        if (error instanceof TrackingNotFoundError) {
          removeConfirmedOrder(order.token);
        }
        throw error;
      }
    },
    enabled: order !== null,
    staleTime: ACTIVE_ORDER_CACHE_MS,
    gcTime: ACTIVE_ORDER_CACHE_MS,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}
