import type { AdminOrderListItem } from "@entana/contracts";
import { useInfiniteQuery } from "@tanstack/react-query";

import type { AdminFailure } from "../../../data-fetching/fetch-admin";
import { AdminRequestError } from "../../../data-fetching/admin-request-error";
import { fetchOrderList } from "./orders-calls";
import type { OrderListRequest } from "./orders-calls";

/** Everything the lists and the counters of the screen cache under this key. */
export const ORDERS_KEY = ["admin-orders"] as const;

export interface OrderPages {
  /** Every row loaded so far, newest first. */
  readonly items: readonly AdminOrderListItem[];
  /** Every order of the filters, not only the loaded ones. */
  readonly totalCount: number;
  readonly hasNextPage: boolean;
  readonly isFetchingNextPage: boolean;
  readonly isPending: boolean;
  readonly isSuccess: boolean;
  readonly errorKind: AdminFailure["kind"] | null;
  readonly showMore: () => void;
  readonly retry: () => void;
}

/** A list read page after page by cursor: "show more" appends the next page. */
export function useOrderPages(request: OrderListRequest, isEnabled: boolean): OrderPages {
  const query = useInfiniteQuery({
    queryKey: [...ORDERS_KEY, "list", request],
    queryFn: ({ pageParam, signal }) => fetchOrderList(request, pageParam, signal),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled: isEnabled,
    // The list changes when the person asks (the banner, an action), never because the tab got
    // the focus back: only the counters poll.
    refetchOnWindowFocus: false,
  });
  const pages = query.data?.pages ?? [];
  return {
    items: pages.flatMap((page) => page.items),
    totalCount: pages.at(-1)?.totalCount ?? 0,
    hasNextPage: query.hasNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
    isPending: isEnabled && query.isPending,
    isSuccess: query.isSuccess,
    errorKind: query.error instanceof AdminRequestError ? query.error.kind : null,
    showMore: () => {
      void query.fetchNextPage();
    },
    retry: () => {
      void query.refetch();
    },
  };
}
