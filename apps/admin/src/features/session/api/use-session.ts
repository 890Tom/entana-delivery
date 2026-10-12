import type { AdminProfile } from "@entana/contracts";
import { useQuery } from "@tanstack/react-query";

import { AdminRequestError } from "./admin-request-error";
import { fetchProfile } from "./session-calls";

/** The one cache entry of the signed-in profile. */
export const SESSION_KEY = ["admin", "session"] as const;

export type SessionState =
  | { readonly status: "loading" }
  | { readonly status: "authenticated"; readonly profile: AdminProfile }
  | { readonly status: "anonymous" }
  | { readonly status: "failed"; readonly retry: () => void };

/** Reads the session from the server: nothing is kept in the browser's storage. */
export function useSession(): SessionState {
  const query = useQuery({
    queryKey: SESSION_KEY,
    queryFn: ({ signal }) => fetchProfile(signal),
  });
  if (query.data !== undefined) {
    return { status: "authenticated", profile: query.data };
  }
  if (query.isPending) {
    return { status: "loading" };
  }
  if (query.error instanceof AdminRequestError && query.error.kind === "unauthorized") {
    return { status: "anonymous" };
  }
  return {
    status: "failed",
    retry: () => {
      void query.refetch();
    },
  };
}
