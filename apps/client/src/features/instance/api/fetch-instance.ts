import { publicInstanceSchema } from "@entana/contracts";
import type { PublicInstance } from "@entana/contracts";

import { fetchValidated } from "../../../data-fetching/fetch-validated";
import type { RequestErrorKind } from "../../../data-fetching/fetch-validated";

/** Carries only a kind: no response text, no status, no URL can leak through it. */
export class InstanceError extends Error {
  readonly kind: RequestErrorKind;

  constructor(kind: RequestErrorKind) {
    super(`Instance request failed: ${kind}`);
    this.name = "InstanceError";
    this.kind = kind;
  }
}

/** GET the public part of the instance configuration. Rejects with an InstanceError. */
export function fetchInstance(signal?: AbortSignal): Promise<PublicInstance> {
  return fetchValidated({
    url: "/api/v1/instance",
    schema: publicInstanceSchema,
    signal,
    createError: (kind) => new InstanceError(kind),
  });
}
