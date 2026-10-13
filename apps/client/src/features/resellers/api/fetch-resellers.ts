import { resellerListResponseSchema } from "@entana/contracts";
import type { ResellerListResponse } from "@entana/contracts";

import { fetchValidated } from "../../../data-fetching/fetch-validated";
import type { RequestErrorKind } from "../../../data-fetching/fetch-validated";

export type ResellersErrorKind = RequestErrorKind;

/** Carries only a kind: no response text, no status, no URL can leak through it. */
class ResellersError extends Error {
  readonly kind: ResellersErrorKind;

  constructor(kind: ResellersErrorKind) {
    super(`Resellers request failed: ${kind}`);
    this.name = "ResellersError";
    this.kind = kind;
  }
}

export function readResellersErrorKind(error: unknown): ResellersErrorKind {
  return error instanceof ResellersError ? error.kind : "unexpected";
}

/** GET the public list of resellers. The request carries nothing about the customer. */
export function fetchResellers(signal?: AbortSignal): Promise<ResellerListResponse> {
  return fetchValidated({
    url: "/api/v1/resellers",
    schema: resellerListResponseSchema,
    signal,
    createError: (kind) => new ResellersError(kind),
  });
}
