import { adminProductListResponseSchema, adminProductSchema } from "@entana/contracts";
import type { AdminProduct, AdminProductListResponse } from "@entana/contracts";

import { fetchAdmin } from "../../../data-fetching/fetch-admin";
import type { CreateBody, UpdateBody } from "../rules/product-form";
import type { AdminResult } from "../../../data-fetching/fetch-admin";
import { AdminRequestError } from "../../../data-fetching/admin-request-error";

const PRODUCTS_API_PATH = "/api/v1/admin/products";

const productPath = (productId: string, action: string): string =>
  `${PRODUCTS_API_PATH}/${encodeURIComponent(productId)}/${action}`;

/** The whole catalogue, retired products included. Rejects with a kind only. */
export async function fetchProducts(signal?: AbortSignal): Promise<AdminProductListResponse> {
  const result = await fetchAdmin(
    { path: PRODUCTS_API_PATH, signal },
    adminProductListResponseSchema,
  );
  if (result.kind !== "ok") {
    throw new AdminRequestError(result.kind);
  }
  return result.data;
}

/** Sets the availability of one product. The answer is a value: the screen words the failure. */
export function patchAvailability(
  productId: string,
  isAvailable: boolean,
): Promise<AdminResult<AdminProduct>> {
  return fetchAdmin(
    {
      path: productPath(productId, "availability"),
      method: "PATCH",
      body: { available: isAvailable },
    },
    adminProductSchema,
  );
}

/** Writes the display order: the complete list of the active products. */
export function putProductOrder(
  ids: readonly string[],
): Promise<AdminResult<AdminProductListResponse>> {
  return fetchAdmin(
    { path: `${PRODUCTS_API_PATH}/order`, method: "PUT", body: { ids } },
    adminProductListResponseSchema,
  );
}

export function postRetire(productId: string): Promise<AdminResult<AdminProduct>> {
  return fetchAdmin({ path: productPath(productId, "retire"), method: "POST" }, adminProductSchema);
}

export function postRestore(productId: string): Promise<AdminResult<AdminProduct>> {
  return fetchAdmin(
    { path: productPath(productId, "restore"), method: "POST" },
    adminProductSchema,
  );
}

/** Creates a product: it is retired until it is published (see `patchProduct`). */
export function postProduct(body: CreateBody): Promise<AdminResult<AdminProduct>> {
  return fetchAdmin({ path: PRODUCTS_API_PATH, method: "POST", body }, adminProductSchema);
}

/** Changes some fields of a product, or its `retired` (visible in the catalogue = not retired). */
export function patchProduct(
  productId: string,
  body: UpdateBody | { readonly retired: boolean },
): Promise<AdminResult<AdminProduct>> {
  return fetchAdmin(
    { path: `${PRODUCTS_API_PATH}/${encodeURIComponent(productId)}`, method: "PATCH", body },
    adminProductSchema,
  );
}

/** Sends or replaces the photo: one multipart file named "photo". */
export function putProductPhoto(
  productId: string,
  photo: File,
): Promise<AdminResult<AdminProduct>> {
  const form = new FormData();
  form.set("photo", photo);
  return fetchAdmin(
    { path: productPath(productId, "photo"), method: "PUT", body: form },
    adminProductSchema,
  );
}
