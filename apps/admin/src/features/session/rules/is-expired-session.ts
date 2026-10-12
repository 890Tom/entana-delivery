import { AdminRequestError } from "../../../data-fetching/admin-request-error";

/**
 * A refusal (401) on a call that had data: the session was valid and no longer is. The same
 * refusal on a first load only says that nobody is signed in.
 */
export function isExpiredSession(error: unknown, hasData: boolean): boolean {
  return hasData && error instanceof AdminRequestError && error.kind === "unauthorized";
}
