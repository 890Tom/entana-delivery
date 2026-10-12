import { adminOrderDetailSchema } from "@entana/contracts";
import type { AdminOrderDetail, StatusTransitionRequest } from "@entana/contracts";

import { fetchAdmin } from "../../../data-fetching/fetch-admin";
import type { AdminResult } from "../../../data-fetching/fetch-admin";
import { AdminRequestError } from "../../../data-fetching/admin-request-error";

const ORDERS_API_PATH = "/api/v1/admin/orders";

/** One order. Rejects with an AdminRequestError that carries a kind only (`not_found` for a 404). */
export async function fetchOrderDetail(
  orderId: string,
  signal?: AbortSignal,
): Promise<AdminOrderDetail> {
  const result = await fetchAdmin(
    { path: `${ORDERS_API_PATH}/${encodeURIComponent(orderId)}`, signal },
    adminOrderDetailSchema,
  );
  if (result.kind !== "ok") {
    throw new AdminRequestError(result.kind);
  }
  return result.data;
}

/** One status change of one order. The answer is a value: the screen decides what to say. */
export function postStatusTransition(
  orderId: string,
  request: StatusTransitionRequest,
): Promise<AdminResult<AdminOrderDetail>> {
  return fetchAdmin(
    {
      path: `${ORDERS_API_PATH}/${encodeURIComponent(orderId)}/transitions`,
      method: "POST",
      body: request,
    },
    adminOrderDetailSchema,
  );
}
