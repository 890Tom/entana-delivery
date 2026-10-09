import { productListResponseSchema } from "@entana/contracts";
import type { ProductListResponse } from "@entana/contracts";

import { REQUEST_ERROR_KINDS, fetchValidated } from "../../../data-fetching/fetch-validated";
import type { RequestErrorKind } from "../../../data-fetching/fetch-validated";

export const CATALOGUE_ERROR_KINDS = REQUEST_ERROR_KINDS;

export type CatalogueErrorKind = RequestErrorKind;

/** Carries only a kind: no response text, no status, no URL can leak through it. */
export class CatalogueError extends Error {
  readonly kind: CatalogueErrorKind;

  constructor(kind: CatalogueErrorKind) {
    super(`Catalogue request failed: ${kind}`);
    this.name = "CatalogueError";
    this.kind = kind;
  }
}

export function readCatalogueErrorKind(error: unknown): CatalogueErrorKind {
  return error instanceof CatalogueError ? error.kind : "unexpected";
}

/** GET the public catalogue. Rejects with a CatalogueError, or with the abort of `signal`. */
export function fetchProducts(signal?: AbortSignal): Promise<ProductListResponse> {
  return fetchValidated({
    url: "/api/v1/products",
    schema: productListResponseSchema,
    signal,
    createError: (kind) => new CatalogueError(kind),
  });
}
