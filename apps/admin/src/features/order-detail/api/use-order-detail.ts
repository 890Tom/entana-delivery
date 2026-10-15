import type { AdminOrderDetail } from "@entana/contracts";
import { useQuery } from "@tanstack/react-query";

import { AdminRequestError } from "../../../data-fetching/admin-request-error";
import { ORDERS_KEY } from "../../orders/api/use-order-pages";
import { fetchOrderDetail } from "./order-detail-calls";

/** Under the key of the orders: whatever reloads the orders reloads the open sheet too. */
export const orderDetailKey = (orderId: string): readonly string[] => [
  ...ORDERS_KEY,
  "detail",
  orderId,
];

export type OrderDetailState =
  | { readonly status: "loading" }
  | { readonly status: "not_found" }
  | { readonly status: "failed"; readonly retry: () => void }
  | { readonly status: "ready"; readonly order: AdminOrderDetail };

/** The order of the sheet; it is read again when the tab gets the focus back. */
export function useOrderDetail(orderId: string): OrderDetailState {
  const query = useQuery({
    queryKey: orderDetailKey(orderId),
    queryFn: ({ signal }) => fetchOrderDetail(orderId, signal),
    refetchOnWindowFocus: true,
  });
  if (query.data !== undefined) {
    return { status: "ready", order: query.data };
  }
  if (query.isPending) {
    return { status: "loading" };
  }
  if (query.error instanceof AdminRequestError && query.error.kind === "not_found") {
    return { status: "not_found" };
  }
  return {
    status: "failed",
    retry: () => {
      void query.refetch();
    },
  };
}
