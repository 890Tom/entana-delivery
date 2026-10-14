import {
  adminDeliveryAxisListResponseSchema,
  deliveryResolveResponseSchema,
} from "@entana/contracts";
import type {
  AdminDeliveryAxisListResponse,
  DeliveryResolveResponse,
  GeoPoint,
} from "@entana/contracts";

import { AdminRequestError } from "../../../data-fetching/admin-request-error";
import { fetchAdmin } from "../../../data-fetching/fetch-admin";
import type { AdminResult } from "../../../data-fetching/fetch-admin";

const AXES_API_PATH = "/api/v1/admin/delivery/axes";
const RESOLVE_API_PATH = "/api/v1/admin/delivery/resolve";
const COORDINATE_DECIMALS = 6;

/** Every axis, active or not, by rank. Rejects with a kind only. */
export async function fetchAxes(signal?: AbortSignal): Promise<AdminDeliveryAxisListResponse> {
  const result = await fetchAdmin(
    { path: AXES_API_PATH, signal },
    adminDeliveryAxisListResponseSchema,
  );
  if (result.kind !== "ok") {
    throw new AdminRequestError(result.kind);
  }
  return result.data;
}

/** The new priority: every id of the shop's axes, from the highest priority to the lowest. */
export function putAxesOrder(
  ids: readonly string[],
): Promise<AdminResult<AdminDeliveryAxisListResponse>> {
  return fetchAdmin(
    { path: `${AXES_API_PATH}/order`, method: "PUT", body: { ids } },
    adminDeliveryAxisListResponseSchema,
  );
}

/** What the server computes for a point: the axis and place it falls in, or the fee outside. */
export function resolvePoint(point: GeoPoint): Promise<AdminResult<DeliveryResolveResponse>> {
  // Six decimals are a tenth of a metre, and never the exponent notation the API refuses.
  const query = new URLSearchParams({
    latitude: point.lat.toFixed(COORDINATE_DECIMALS),
    longitude: point.lng.toFixed(COORDINATE_DECIMALS),
  });
  return fetchAdmin(
    { path: `${RESOLVE_API_PATH}?${query.toString()}` },
    deliveryResolveResponseSchema,
  );
}
