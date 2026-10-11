import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { jsonResponse } from "../../../test-support/stub-fetch";

import { useLookup } from "./use-lookup";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("the lookup mutation", () => {
  it("leaves nothing of the values or of the answer in the cache once its screen is gone", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(jsonResponse({}, 404))),
    );
    const client = new QueryClient();
    const wrapper = ({ children }: { children: ReactNode }): ReactElement => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result, unmount } = renderHook(() => useLookup(), { wrapper });

    let answer: unknown;
    await act(async () => {
      answer = await result.current.mutateAsync({ phone: "+261341234567", orderCode: "K7M2QX" });
    });
    expect(answer).toStrictEqual({ kind: "not_found" });
    unmount();

    // The cache drops an unobserved mutation at the next tick (`gcTime: 0`).
    await waitFor(() => {
      expect(client.getMutationCache().getAll()).toHaveLength(0);
    });
    expect(client.getQueryCache().getAll()).toHaveLength(0);
  });
});
