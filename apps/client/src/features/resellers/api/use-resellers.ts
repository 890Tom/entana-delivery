import type { ResellerListResponse } from "@entana/contracts";
import { useQuery } from "@tanstack/react-query";
import type { UseQueryResult } from "@tanstack/react-query";

import { fetchResellers } from "./fetch-resellers";

export function useResellers(): UseQueryResult<ResellerListResponse> {
  return useQuery({
    queryKey: ["resellers"],
    queryFn: ({ signal }) => fetchResellers(signal),
  });
}
