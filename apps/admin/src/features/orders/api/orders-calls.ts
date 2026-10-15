import {
  adminOrderDetailSchema,
  adminOrderListResponseSchema,
  adminOrderSummaryResponseSchema,
} from "@entana/contracts";
import type {
  AdminOrderDetail,
  AdminOrderListResponse,
  AdminOrderSummaryResponse,
  OrderStatus,
} from "@entana/contracts";

import { fetchAdmin } from "../../../data-fetching/fetch-admin";
import type { AdminResult } from "../../../data-fetching/fetch-admin";
import { AdminRequestError } from "../../../data-fetching/admin-request-error";

const ORDERS_API_PATH = "/api/v1/admin/orders";

/** What a list asks for. `date`, `zone` and `q` are left out when the screen does not filter on them. */
export interface OrderListRequest {
  readonly statuses: readonly OrderStatus[];
  readonly date?: string;
  /** The id of an axis, or "none" for the orders outside every axis. */
  readonly zone?: string;
  readonly q?: string;
  readonly limit?: number;
}

function toQueryString(request: OrderListRequest, cursor: string | null): string {
  const query = new URLSearchParams({ status: request.statuses.join(",") });
  if (request.date !== undefined) {
    query.set("date", request.date);
  }
  if (request.zone !== undefined) {
    query.set("zone", request.zone);
  }
  if (request.q !== undefined) {
    query.set("q", request.q);
  }
  if (request.limit !== undefined) {
    query.set("limit", String(request.limit));
  }
  if (cursor !== null) {
    query.set("cursor", cursor);
  }
  return query.toString();
}

/** One page of the list. Rejects with an AdminRequestError that carries a kind only. */
export async function fetchOrderList(
  request: OrderListRequest,
  cursor: string | null,
  signal?: AbortSignal,
): Promise<AdminOrderListResponse> {
  const result = await fetchAdmin(
    { path: `${ORDERS_API_PATH}?${toQueryString(request, cursor)}`, signal },
    adminOrderListResponseSchema,
  );
  if (result.kind !== "ok") {
    throw new AdminRequestError(result.kind);
  }
  return result.data;
}

/** The counters; with `since`, the orders NEW that came after that order too. */
export async function fetchOrdersSummary(
  since: string | null,
  signal?: AbortSignal,
): Promise<AdminOrderSummaryResponse> {
  const query = since === null ? "" : `?since=${encodeURIComponent(since)}`;
  const result = await fetchAdmin(
    { path: `${ORDERS_API_PATH}/summary${query}`, signal },
    adminOrderSummaryResponseSchema,
  );
  if (result.kind !== "ok") {
    throw new AdminRequestError(result.kind);
  }
  return result.data;
}

/** One step of one order. The answer is a value: the screen decides what to say about it. */
export function postTransition(
  orderId: string,
  to: "OUT_FOR_DELIVERY" | "DELIVERED",
): Promise<AdminResult<AdminOrderDetail>> {
  return fetchAdmin(
    {
      path: `${ORDERS_API_PATH}/${encodeURIComponent(orderId)}/transitions`,
      method: "POST",
      body: { to },
    },
    adminOrderDetailSchema,
  );
}
