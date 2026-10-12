import { DEFAULT_ADMIN_ORDER_LIMIT } from "@entana/contracts";
import type { AdminOrderListItem } from "@entana/contracts";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import type { AdminFailure } from "../../../data-fetching/fetch-admin";
import { AdminRequestError } from "../../session/api/admin-request-error";
import { fetchOrderList } from "../api/orders-calls";
import type { OrderListRequest } from "../api/orders-calls";
import { countPages } from "../rules/page-count";

import { ORDERS_KEY } from "./use-order-pages";

export interface OrderTablePage {
  /** The rows of the current page only. */
  readonly items: readonly AdminOrderListItem[];
  readonly totalCount: number;
  /** From 1. */
  readonly pageNumber: number;
  readonly pageCount: number;
  readonly hasPrevious: boolean;
  readonly hasNext: boolean;
  readonly isPending: boolean;
  readonly isSuccess: boolean;
  readonly errorKind: AdminFailure["kind"] | null;
  readonly showPrevious: () => void;
  readonly showNext: () => void;
  readonly retry: () => void;
}

interface CursorTrail {
  /** The request the trail belongs to: another request starts again from the first page. */
  readonly requestKey: string;
  /** The cursor of each page visited, the first page having none. The last one is current. */
  readonly cursors: readonly (string | null)[];
}

const FIRST_PAGE: readonly (string | null)[] = [null];

function toErrorKind(error: unknown): AdminFailure["kind"] | null {
  return error instanceof AdminRequestError ? error.kind : null;
}

/**
 * The table, one page at a time. The API pages by cursor (no page number), so the cursors of
 * the pages visited are kept: "previous" is the one before, and a page that was read is cached.
 */
export function useOrderTablePage(request: OrderListRequest, isEnabled: boolean): OrderTablePage {
  const requestKey = JSON.stringify(request);
  const [trail, setTrail] = useState<CursorTrail>({ requestKey, cursors: FIRST_PAGE });
  const cursors = trail.requestKey === requestKey ? trail.cursors : FIRST_PAGE;
  const cursor = cursors.at(-1) ?? null;
  const query = useQuery({
    queryKey: [...ORDERS_KEY, "list", request, cursor],
    queryFn: ({ signal }) => fetchOrderList(request, cursor, signal),
    enabled: isEnabled,
    // The list changes when the person asks (an action, the banner), not when the tab is focused.
    refetchOnWindowFocus: false,
  });
  const nextCursor = query.data?.nextCursor ?? null;
  const totalCount = query.data?.totalCount ?? 0;
  return {
    items: query.data?.items ?? [],
    totalCount,
    pageNumber: cursors.length,
    pageCount: Math.max(countPages(totalCount, DEFAULT_ADMIN_ORDER_LIMIT), cursors.length),
    hasPrevious: cursors.length > 1,
    hasNext: nextCursor !== null,
    isPending: isEnabled && query.isPending,
    isSuccess: query.isSuccess,
    errorKind: toErrorKind(query.error),
    showPrevious: () => {
      setTrail({ requestKey, cursors: cursors.slice(0, -1) });
    },
    showNext: () => {
      if (nextCursor !== null) {
        setTrail({ requestKey, cursors: [...cursors, nextCursor] });
      }
    },
    retry: () => {
      void query.refetch();
    },
  };
}
