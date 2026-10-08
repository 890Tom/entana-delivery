import { vi } from "vitest";
import type { Mock } from "vitest";

type FetchStub = Mock<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>;

/** Replaces the global fetch (the network boundary, the only thing stubbed). */
export function stubFetch(
  implementation: (init: RequestInit | undefined) => Promise<Response>,
): FetchStub {
  const stub: FetchStub = vi.fn((_input, init) => implementation(init));
  vi.stubGlobal("fetch", stub);
  return stub;
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** An RFC 9457 error whose text must never reach the user interface. */
export function problemResponse(status: number): Response {
  return new Response(
    JSON.stringify({ type: "about:blank", title: "SECRET-TITLE", status, detail: "SECRET-DETAIL" }),
    { status, headers: { "Content-Type": "application/problem+json" } },
  );
}

/** A request that stays pending until its signal is aborted, like a real one. */
export function pendingUntilAborted(init: RequestInit | undefined): Promise<Response> {
  return new Promise((_resolve, reject) => {
    const abort = (): void => {
      reject(new DOMException("The operation was aborted.", "AbortError"));
    };
    if (init?.signal?.aborted === true) {
      abort();
    }
    init?.signal?.addEventListener("abort", abort);
  });
}
