import { productListResponseSchema } from "@entana/contracts";
import type { ProductListResponse } from "@entana/contracts";

const PRODUCTS_URL = "/api/v1/products";
const TIMEOUT_MS = 10_000;

export const CATALOGUE_ERROR_KINDS = ["network", "timeout", "server", "unexpected"] as const;

export type CatalogueErrorKind = (typeof CATALOGUE_ERROR_KINDS)[number];

/** Carries only a kind: no response text, no status, no URL can leak through it. */
export class CatalogueError extends Error {
  readonly kind: CatalogueErrorKind;

  constructor(kind: CatalogueErrorKind) {
    super(`Catalogue request failed: ${kind}`);
    this.name = "CatalogueError";
    this.kind = kind;
  }
}

async function readProducts(response: Response): Promise<ProductListResponse> {
  if (response.status >= 500) {
    throw new CatalogueError("server");
  }
  if (!response.ok) {
    throw new CatalogueError("unexpected");
  }
  const body: unknown = await response.json();
  const parsed = productListResponseSchema.safeParse(body);
  if (!parsed.success) {
    throw new CatalogueError("unexpected");
  }
  return parsed.data;
}

function classifyFailure(
  error: unknown,
  isTimedOut: boolean,
  callerSignal: AbortSignal | undefined,
): unknown {
  if (error instanceof CatalogueError) {
    return error;
  }
  if (isTimedOut) {
    return new CatalogueError("timeout");
  }
  if (callerSignal?.aborted === true) {
    // The caller cancelled on purpose (unmount): this is not a failure to report.
    return error;
  }
  // A body that is not JSON also lands here: a SyntaxError is "unexpected", a dropped connection
  // or a failed fetch is "network".
  return new CatalogueError(error instanceof SyntaxError ? "unexpected" : "network");
}

/** GET the public catalogue. Rejects with a CatalogueError, or with the abort of `signal`. */
export async function fetchProducts(signal?: AbortSignal): Promise<ProductListResponse> {
  const timeout = new AbortController();
  const timer = setTimeout(() => {
    timeout.abort();
  }, TIMEOUT_MS);
  const combined =
    signal === undefined ? timeout.signal : AbortSignal.any([signal, timeout.signal]);
  try {
    const response = await fetch(PRODUCTS_URL, {
      method: "GET",
      credentials: "omit",
      signal: combined,
    });
    return await readProducts(response);
  } catch (error: unknown) {
    throw classifyFailure(error, timeout.signal.aborted, signal);
  } finally {
    clearTimeout(timer);
  }
}
