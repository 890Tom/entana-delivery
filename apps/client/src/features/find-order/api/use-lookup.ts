import type { TrackingLookupRequest } from "@entana/contracts";
import { useMutation } from "@tanstack/react-query";
import type { UseMutationResult } from "@tanstack/react-query";

import { lookupOrder } from "./request-lookup";
import type { LookupResult } from "./request-lookup";

/**
 * A mutation, not a query: the phone number and the code are never part of a key, and nothing of
 * them or of the answer stays in the cache once the screen that asked is gone (`gcTime: 0`).
 */
export function useLookup(): UseMutationResult<LookupResult, Error, TrackingLookupRequest> {
  return useMutation({ mutationFn: lookupOrder, gcTime: 0 });
}
