import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { buildInstance } from "../../../test-support/builders/build-instance";
import { buildInstanceTheme } from "../../../test-support/builders/build-instance-theme";
import { jsonResponse, problemResponse, stubFetch } from "../../../test-support/stubs/stub-fetch";
import { readStoredTheme, writeStoredTheme } from "../theme/instance-theme-storage";

import { useInstance } from "./use-instance";

const ACCENT = "--color-accent";

function wrapper({ children }: { children: ReactNode }): ReactElement {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

function accentOfDocument(): string {
  return document.documentElement.style.getPropertyValue(ACCENT);
}

beforeEach(() => {
  localStorage.clear();
  document.documentElement.style.removeProperty(ACCENT);
});

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
  document.documentElement.style.removeProperty(ACCENT);
});

describe("useInstance and the theme", () => {
  it("has the colours on the document before a component receives the instance", async () => {
    stubFetch(() => Promise.resolve(jsonResponse(buildInstance({ theme: buildInstanceTheme() }))));
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

  it("replaces the theme kept on the device with the one of the instance", async () => {
    writeStoredTheme(buildInstanceTheme({ accent: "#d97706" }));
    stubFetch(() => Promise.resolve(jsonResponse(buildInstance({ theme: buildInstanceTheme() }))));

    const { result } = renderHook(() => useInstance(), { wrapper });
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(readStoredTheme()?.accent).toBe("#2d6cdf");
  });

  it("keeps the theme of the device when the instance cannot be loaded", async () => {
    writeStoredTheme(buildInstanceTheme());
    document.documentElement.style.setProperty(ACCENT, "#2d6cdf");
    stubFetch(() => Promise.resolve(problemResponse(500)));

    const { result } = renderHook(() => useInstance(), { wrapper });
    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(accentOfDocument()).toBe("#2d6cdf");
    expect(readStoredTheme()).toEqual(buildInstanceTheme());
  });
});
