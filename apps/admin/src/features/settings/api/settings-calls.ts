import { deliverySettingsSchema } from "@entana/contracts";
import type { DeliverySettings, UpdateDeliverySettingsRequest } from "@entana/contracts";

import { AdminRequestError } from "../../../data-fetching/admin-request-error";
import { fetchAdmin } from "../../../data-fetching/fetch-admin";
import type { AdminResult } from "../../../data-fetching/fetch-admin";

const SETTINGS_API_PATH = "/api/v1/admin/delivery/settings";

/** The delivery settings of the shop. Rejects with a kind only. */
export async function fetchSettings(signal?: AbortSignal): Promise<DeliverySettings> {
  const result = await fetchAdmin({ path: SETTINGS_API_PATH, signal }, deliverySettingsSchema);
  if (result.kind !== "ok") {
    throw new AdminRequestError(result.kind);
  }
  return result.data;
}

/** A partial change: the answer is the whole settings after it. */
export function patchSettings(
  body: UpdateDeliverySettingsRequest,
): Promise<AdminResult<DeliverySettings>> {
  return fetchAdmin({ path: SETTINGS_API_PATH, method: "PATCH", body }, deliverySettingsSchema);
}
