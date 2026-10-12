import { adminProfileSchema } from "@entana/contracts";
import type { AdminLoginRequest, AdminProfile } from "@entana/contracts";

import { fetchAdmin, sendAdminAction } from "../../../data-fetching/fetch-admin";
import type { AdminResult } from "../../../data-fetching/fetch-admin";

import { AdminRequestError } from "../../../data-fetching/admin-request-error";

const ME_PATH = "/api/v1/admin/auth/me";
const LOGIN_API_PATH = "/api/v1/admin/auth/login";
const LOGOUT_API_PATH = "/api/v1/admin/auth/logout";

/** Who is signed in. Rejects with an AdminRequestError (a 401 included). */
export async function fetchProfile(signal?: AbortSignal): Promise<AdminProfile> {
  const result = await fetchAdmin({ path: ME_PATH, signal }, adminProfileSchema);
  if (result.kind !== "ok") {
    throw new AdminRequestError(result.kind);
  }
  return result.data;
}

/** The login is a form action: its answer is a value, the screen decides what to say. */
export function postLogin(request: AdminLoginRequest): Promise<AdminResult<AdminProfile>> {
  return fetchAdmin({ path: LOGIN_API_PATH, method: "POST", body: request }, adminProfileSchema);
}

export function postLogout(): Promise<AdminResult<null>> {
  return sendAdminAction({ path: LOGOUT_API_PATH, method: "POST" });
}
