import type { AdminFailure } from "../../../data-fetching/fetch-admin";

/** What a refused request shows. Every word is chosen by the screen: nothing comes from the server. */
export interface FailureView {
  /** The visibility switch says that the consent is needed. */
  readonly hasPublishError: boolean;
  readonly notice: "failed" | "gone" | null;
  /** The session ended: the screen says nothing, the next read shows the sign-in. */
  readonly isUnauthorized: boolean;
}

export function describeFailure(failure: AdminFailure): FailureView {
  if (failure.kind === "unauthorized") {
    return { hasPublishError: false, notice: null, isUnauthorized: true };
  }
  if (failure.problem === "notPublishable") {
    return { hasPublishError: true, notice: null, isUnauthorized: false };
  }
  return {
    hasPublishError: false,
    notice: failure.kind === "not_found" ? "gone" : "failed",
    isUnauthorized: false,
  };
}
