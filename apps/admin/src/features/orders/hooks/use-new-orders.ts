import type { AdminOrderSummaryResponse } from "@entana/contracts";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { fetchOrdersSummary } from "../api/orders-calls";

import { ORDERS_KEY } from "./use-order-pages";

const POLL_MS = 30_000;
// An id older than any order: when no order to process is displayed, every one of them is new.
const NO_ORDER_SEEN = "00000000-0000-0000-0000-000000000000";

export interface NewOrders {
  readonly summary: AdminOrderSummaryResponse | undefined;
  readonly banner: {
    readonly count: number;
    readonly latest: { readonly publicCode: string; readonly customerName: string } | null;
  } | null;
  /** Hides the banner for the orders it announced. */
  readonly acknowledge: () => void;
}

const greatest = (first: string | null, second: string): string =>
  first !== null && first > second ? first : second;

function toBanner(
  newSince: AdminOrderSummaryResponse["newSince"],
  hiddenFor: string | null,
): NewOrders["banner"] {
  const latest = newSince?.latest ?? null;
  const count = newSince?.count ?? 0;
  if (count === 0 || (latest !== null && latest.id === hiddenFor)) {
    return null;
  }
  return {
    count,
    latest:
      latest === null ? null : { publicCode: latest.publicCode, customerName: latest.customerName },
  };
}

/**
 * The counters of the screen, and the orders that came after the newest one displayed. ids are
 * uuidv7: the greatest is the newest. The mark only moves forward, so a search that shows fewer
 * orders never makes an old order look new. The poll runs only while the tab is visible (React
 * Query pauses it in the background) and again when the tab gets the focus back.
 */
export function useNewOrders(displayedIds: readonly string[], isLoaded: boolean): NewOrders {
  const [seenUpTo, setSeenUpTo] = useState<string | null>(null);
  const [hiddenFor, setHiddenFor] = useState<string | null>(null);
  const newest = displayedIds.reduce<string | null>((top, id) => greatest(top, id), null);
  useEffect(() => {
    if (isLoaded) {
      setSeenUpTo((mark) => greatest(mark, newest ?? NO_ORDER_SEEN));
    }
  }, [isLoaded, newest]);
  const query = useQuery({
    queryKey: [...ORDERS_KEY, "summary", seenUpTo],
    queryFn: ({ signal }) => fetchOrdersSummary(seenUpTo, signal),
    placeholderData: keepPreviousData,
    refetchInterval: POLL_MS,
    refetchOnWindowFocus: true,
  });
  return {
    summary: query.data,
    banner: toBanner(query.data?.newSince, hiddenFor),
    acknowledge: () => {
      setHiddenFor(query.data?.newSince?.latest?.id ?? null);
    },
  };
}
