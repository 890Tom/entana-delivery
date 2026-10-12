import { QueryCache, QueryClient } from "@tanstack/react-query";

import { isExpiredSession } from "../features/session/rules/is-expired-session";

/**
 * No automatic retry: a failure shows its state at once and the person retries by hand (a 401
 * is an answer, not a hiccup). A refused session on a call that had worked means the session
 * ended elsewhere: everything held in memory is dropped, then `onSessionExpired` leaves.
 */
export function createQueryClient(onSessionExpired: () => void): QueryClient {
  const client: QueryClient = new QueryClient({
    queryCache: new QueryCache({
      onError: (error, query) => {
        if (isExpiredSession(error, query.state.data !== undefined)) {
          client.clear();
          onSessionExpired();
        }
      },
    }),
    defaultOptions: { queries: { retry: false } },
  });
  return client;
}
