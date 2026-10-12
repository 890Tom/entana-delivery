import type { AdminFailure } from "./fetch-admin";

/** Carries only a kind: no response text, no status, no URL can leak through it. */
export class AdminRequestError extends Error {
  readonly kind: AdminFailure["kind"];

  constructor(kind: AdminFailure["kind"]) {
    super(`Administration request failed: ${kind}`);
    this.name = "AdminRequestError";
    this.kind = kind;
  }
}
