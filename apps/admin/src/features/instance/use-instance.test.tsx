import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { buildInstance } from "../../test-support/builders/build-instance";
import { buildInstanceTheme } from "../../test-support/builders/build-instance-theme";
import { jsonResponse, problemResponse } from "../../test-support/stubs/stub-api";

import { useInstance } from "./use-instance";

const ACCENT = "--color-accent";

function wrapper({ children }: { children: ReactNode }): ReactElement {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

function accentOfDocument(): string {
  return document.documentElement.style.getPropertyValue(ACCENT);
}

function answerWith(response: Response): void {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));
}

beforeEach(() => {
  document.documentElement.style.removeProperty(ACCENT);
});

afterEach(() => {
  vi.unstubAllGlobals();
  document.documentElement.style.removeProperty(ACCENT);
});

describe("useInstance and the theme", () => {
  it("has the colours on the document before a component receives the instance", async () => {
    answerWith(jsonResponse(buildInstance({ theme: buildInstanceTheme() })));
    const accentWhenDataArrived: string[] = [];

    const { result } = renderHook(
      () => {
        const instance = useInstance();
        if (instance.data !== undefined) {
          accentWhenDataArrived.push(accentOfDocument());
        }
        return instance;
      },
      { wrapper },
    );
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(accentWhenDataArrived[0]).toBe("#2d6cdf");
  });

  it("replaces the colours already written with the ones of the instance that arrives", async () => {
    document.documentElement.style.setProperty(ACCENT, "#d97706");
    answerWith(jsonResponse(buildInstance({ theme: buildInstanceTheme() })));

    const { result } = renderHook(() => useInstance(), { wrapper });
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(accentOfDocument()).toBe("#2d6cdf");
  });

  it("keeps the colours already written when the instance cannot be loaded", async () => {
    document.documentElement.style.setProperty(ACCENT, "#d97706");
    answerWith(problemResponse(500));

    const { result } = renderHook(() => useInstance(), { wrapper });
    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(accentOfDocument()).toBe("#d97706");
  });
});
