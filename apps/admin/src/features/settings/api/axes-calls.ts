import {
  adminDeliveryAxisListResponseSchema,
  adminDeliveryAxisSchema,
  adminDeliveryPlaceListResponseSchema,
  deliveryResolveResponseSchema,
} from "@entana/contracts";
import type {
  AdminDeliveryAxis,
  AdminDeliveryAxisListResponse,
  AdminDeliveryPlaceListResponse,
  DeliveryResolveResponse,
  GeoPoint,
  SaveDeliveryAxisRequest,
} from "@entana/contracts";

import { AdminRequestError } from "../../../data-fetching/admin-request-error";
import { fetchAdmin, sendAdminAction } from "../../../data-fetching/fetch-admin";
import type { AdminResult } from "../../../data-fetching/fetch-admin";

const AXES_API_PATH = "/api/v1/admin/delivery/axes";
const PLACES_API_PATH = "/api/v1/admin/delivery/places";
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

const axisApiPath = (axisId: string): string => `${AXES_API_PATH}/${encodeURIComponent(axisId)}`;

/** The active places of the shop, by name. Rejects with a kind only. */
export async function fetchPlaces(signal?: AbortSignal): Promise<AdminDeliveryPlaceListResponse> {
  const result = await fetchAdmin(
    { path: PLACES_API_PATH, signal },
    adminDeliveryPlaceListResponseSchema,
  );
  if (result.kind !== "ok") {
    throw new AdminRequestError(result.kind);
  }
  return result.data;
}

/** Creates an axis: it takes the last rank. */
export function postAxis(body: SaveDeliveryAxisRequest): Promise<AdminResult<AdminDeliveryAxis>> {
  return fetchAdmin({ path: AXES_API_PATH, method: "POST", body }, adminDeliveryAxisSchema);
}

/** Replaces the name, the colour, the state and the places of an axis; its rank is kept. */
export function putAxis(
  axisId: string,
  body: SaveDeliveryAxisRequest,
): Promise<AdminResult<AdminDeliveryAxis>> {
  return fetchAdmin({ path: axisApiPath(axisId), method: "PUT", body }, adminDeliveryAxisSchema);
}

/** Deletes an axis that no order uses: the answer is a 204 with no body. */
export function deleteAxis(axisId: string): Promise<AdminResult<null>> {
  return sendAdminAction({ path: axisApiPath(axisId), method: "DELETE" });
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
