import { QueryClient } from "@tanstack/react-query";

// No automatic retry: a failure shows its error state at once and the customer retries by hand.
export function createQueryClient(): QueryClient {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}
