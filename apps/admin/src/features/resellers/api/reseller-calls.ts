import { adminResellerListResponseSchema, adminResellerSchema } from "@entana/contracts";
import type {
  AdminReseller,
  AdminResellerListResponse,
  CreateResellerRequest,
  UpdateResellerRequest,
} from "@entana/contracts";

import { AdminRequestError } from "../../../data-fetching/admin-request-error";
import { fetchAdmin, sendAdminAction } from "../../../data-fetching/fetch-admin";
import type { AdminResult } from "../../../data-fetching/fetch-admin";

const RESELLERS_API_PATH = "/api/v1/admin/resellers";

const resellerApiPath = (resellerId: string): string =>
  `${RESELLERS_API_PATH}/${encodeURIComponent(resellerId)}`;

/** Every reseller, by neighborhood then name (the order of the API). Rejects with a kind only. */
export async function fetchResellers(signal?: AbortSignal): Promise<AdminResellerListResponse> {
  const result = await fetchAdmin(
    { path: RESELLERS_API_PATH, signal },
    adminResellerListResponseSchema,
  );
  if (result.kind !== "ok") {
    throw new AdminRequestError(result.kind);
  }
  return result.data;
}

export function postReseller(body: CreateResellerRequest): Promise<AdminResult<AdminReseller>> {
  return fetchAdmin({ path: RESELLERS_API_PATH, method: "POST", body }, adminResellerSchema);
}

export function patchReseller(
  resellerId: string,
  body: UpdateResellerRequest,
): Promise<AdminResult<AdminReseller>> {
  return fetchAdmin(
    { path: resellerApiPath(resellerId), method: "PATCH", body },
    adminResellerSchema,
  );
}

/** Marks the reseller verified today (the server's clock). */
export function postVerification(resellerId: string): Promise<AdminResult<AdminReseller>> {
  return fetchAdmin(
    { path: `${resellerApiPath(resellerId)}/verify`, method: "POST" },
    adminResellerSchema,
  );
}

/** Deletes the reseller for good: the answer is a 204 with no body. */
export function deleteReseller(resellerId: string): Promise<AdminResult<null>> {
  return sendAdminAction({ path: resellerApiPath(resellerId), method: "DELETE" });
}
