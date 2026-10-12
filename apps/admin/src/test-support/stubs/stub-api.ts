import { vi } from "vitest";

import { buildInstance } from "../builders/build-instance";

export const ROUTES = {
  instance: "GET /api/v1/instance",
  me: "GET /api/v1/admin/auth/me",
  login: "POST /api/v1/admin/auth/login",
  logout: "POST /api/v1/admin/auth/logout",
} as const;

export type Route = (typeof ROUTES)[keyof typeof ROUTES];
export type Handler = (init: RequestInit | undefined) => Response | Promise<Response>;

export interface ApiStub {
  /** Replaces what a route answers from now on. */
  readonly answer: (route: Route, handler: Handler) => void;
  /** The requests a route received, in order. */
  readonly calls: (route: Route) => readonly (RequestInit | undefined)[];
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

/** A dropped connection: what `fetch` does when there is no network. */
export function networkFailure(): Promise<Response> {
  return Promise.reject(new TypeError("Failed to fetch"));
}

/** A request that stays pending until its signal is aborted, like a real one. */
export function pendingUntilAborted(init: RequestInit | undefined): Promise<Response> {
  return new Promise((_resolve, reject) => {
    init?.signal?.addEventListener("abort", () => {
      reject(new DOMException("The operation was aborted.", "AbortError"));
    });
  });
}

function addressOf(input: RequestInfo | URL): string {
  if (typeof input === "string") {
    return input;
  }
  return input instanceof URL ? input.pathname : input.url;
}

/**
 * Replaces the global fetch (the network boundary, the only thing stubbed). A route with no
 * handler is a dropped connection; the instance answers a demo shop unless told otherwise.
 */
export function stubApi(handlers: Partial<Record<Route, Handler>> = {}): ApiStub {
  const table = new Map<string, Handler>(Object.entries(handlers));
  const received = new Map<string, (RequestInit | undefined)[]>();
  if (!table.has(ROUTES.instance)) {
    table.set(ROUTES.instance, () => jsonResponse(buildInstance()));
  }
  vi.stubGlobal(
    "fetch",
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const route = `${init?.method ?? "GET"} ${addressOf(input)}`;
      received.set(route, [...(received.get(route) ?? []), init]);
      const handler = table.get(route);
      return handler === undefined ? networkFailure() : Promise.resolve(handler(init));
    }),
  );
  return {
    answer: (route, handler) => {
      table.set(route, handler);
    },
    calls: (route) => received.get(route) ?? [],
  };
}
