import { vi } from "vitest";

import { buildInstance } from "../builders/build-instance";

export const ROUTES = {
  instance: "GET /api/v1/instance",
  me: "GET /api/v1/admin/auth/me",
  login: "POST /api/v1/admin/auth/login",
  logout: "POST /api/v1/admin/auth/logout",
  orders: "GET /api/v1/admin/orders",
  summary: "GET /api/v1/admin/orders/summary",
  products: "GET /api/v1/admin/products",
  productOrder: "PUT /api/v1/admin/products/order",
} as const;

/** One change of one product of the catalogue: a PATCH of availability, a retire or a restore. */
export const productRoute = (
  productId: string,
  action: "availability" | "retire" | "restore",
): `${"PATCH" | "POST"} /api/v1/admin/products/${string}/${typeof action}` =>
  `${action === "availability" ? "PATCH" : "POST"} /api/v1/admin/products/${productId}/${action}`;

/** The transition of one order: the route of a call is its method and its path, no query. */
export const transitionRoute = (
  orderId: string,
): `POST /api/v1/admin/orders/${string}/transitions` =>
  `POST /api/v1/admin/orders/${orderId}/transitions`;

/** The detail of one order. */
export const detailRoute = (orderId: string): `GET /api/v1/admin/orders/${string}` =>
  `GET /api/v1/admin/orders/${orderId}`;

export type Route =
  | (typeof ROUTES)[keyof typeof ROUTES]
  | `POST /api/v1/admin/orders/${string}/transitions`
  | `GET /api/v1/admin/orders/${string}`
  | ReturnType<typeof productRoute>;
/** The second argument is the address of the call, query string included. */
export type Handler = (
  init: RequestInit | undefined,
  address?: URL,
) => Response | Promise<Response>;

export interface ApiStub {
  /** Replaces what a route answers from now on. */
  readonly answer: (route: Route, handler: Handler) => void;
  /** The requests a route received, in order. */
  readonly calls: (route: Route) => readonly (RequestInit | undefined)[];
  /** The addresses a route received, in order, with their query strings. */
  readonly addresses: (route: Route) => readonly URL[];
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

function addressOf(input: RequestInfo | URL): URL {
  const text = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  return new URL(text, "http://localhost");
}

/** A demo shop without any order, unless the test says otherwise. */
function defaultHandlers(): Record<string, Handler> {
  return {
    [ROUTES.instance]: () => jsonResponse(buildInstance()),
    [ROUTES.orders]: () => jsonResponse({ items: [], totalCount: 0, nextCursor: null }),
    [ROUTES.summary]: (_init, address) =>
      jsonResponse({
        toProcessCount: 0,
        todayCount: 0,
        ...(address?.searchParams.has("since") === true
          ? { newSince: { count: 0, latest: null } }
          : {}),
      }),
  };
}

/**
 * Replaces the global fetch (the network boundary, the only thing stubbed). A route with no
 * handler is a dropped connection; the instance answers a demo shop unless told otherwise.
 */
export function stubApi(handlers: Partial<Record<Route, Handler>> = {}): ApiStub {
  const table = new Map<string, Handler>(Object.entries(defaultHandlers()));
  for (const [route, handler] of Object.entries(handlers)) {
    if (handler !== undefined) {
      table.set(route, handler);
    }
  }
  const received = new Map<string, (RequestInit | undefined)[]>();
  const urls = new Map<string, URL[]>();
  vi.stubGlobal(
    "fetch",
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const address = addressOf(input);
      const route = `${init?.method ?? "GET"} ${address.pathname}`;
      received.set(route, [...(received.get(route) ?? []), init]);
      urls.set(route, [...(urls.get(route) ?? []), address]);
      const handler = table.get(route);
      return handler === undefined ? networkFailure() : Promise.resolve(handler(init, address));
    }),
  );
  return {
    answer: (route, handler) => {
      table.set(route, handler);
    },
    calls: (route) => received.get(route) ?? [],
    addresses: (route) => urls.get(route) ?? [],
  };
}
