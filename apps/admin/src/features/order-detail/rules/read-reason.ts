import { MAX_STATUS_REASON_LENGTH } from "@entana/contracts";

export type ReasonReading =
  { readonly kind: "ok"; readonly reason: string | undefined } | { readonly kind: "too_long" };

/** The optional reason of a refusal: empty is left out of the request, as the server expects. */
export function readReason(typed: string): ReasonReading {
  const reason = typed.trim();
  if (reason.length > MAX_STATUS_REASON_LENGTH) {
    return { kind: "too_long" };
  }
  return { kind: "ok", reason: reason === "" ? undefined : reason };
}
