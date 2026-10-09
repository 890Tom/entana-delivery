import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { buildProduct, buildProductId } from "../../../test-support/build-product";
import {
  jsonResponse,
  pendingUntilAborted,
  problemResponse,
  stubFetch,
} from "../../../test-support/stub-fetch";

import { CatalogueError, fetchProducts } from "./fetch-products";

async function readFailureKind(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error: unknown) {
    return error instanceof CatalogueError ? error.kind : error;
  }
  return "no failure";
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("fetchProducts", () => {
  it("returns the validated products of a valid response", async () => {
    const product = buildProduct({ description: "Riz et zebu" });
    stubFetch(() => Promise.resolve(jsonResponse({ products: [product] })));

    const response = await fetchProducts();

    expect(response).toStrictEqual({ products: [product] });
  });

  it("sends a plain GET without credentials and without extra headers", async () => {
    const stub = stubFetch(() => Promise.resolve(jsonResponse({ products: [] })));

    await fetchProducts();

    const [url, init] = stub.mock.calls[0] ?? [];
    expect(url).toBe("/api/v1/products");
    expect(init?.method).toBe("GET");
    expect(init?.credentials).toBe("omit");
    expect(init?.headers).toBeUndefined();
    expect(init?.body).toBeUndefined();
  });

  it("refuses a 200 with an extra property (unexpected)", async () => {
    stubFetch(() => Promise.resolve(jsonResponse({ products: [], total: 0 })));

    expect(await readFailureKind(fetchProducts())).toBe("unexpected");
  });

  it("refuses a 200 with a product that has an extra property (unexpected)", async () => {
    const product = { ...buildProduct(), sku: "DEMO-SKU-001" };
    stubFetch(() => Promise.resolve(jsonResponse({ products: [product] })));

    expect(await readFailureKind(fetchProducts())).toBe("unexpected");
  });

  it("refuses a 200 with a product missing a field (unexpected)", async () => {
    const incomplete = Object.fromEntries(
      Object.entries(buildProduct({ id: buildProductId(2) })).filter(([key]) => key !== "priceAr"),
    );
    stubFetch(() => Promise.resolve(jsonResponse({ products: [incomplete] })));

    expect(await readFailureKind(fetchProducts())).toBe("unexpected");
  });

  it("refuses a 200 with a body that is not JSON (unexpected)", async () => {
    stubFetch(() => Promise.resolve(new Response("<html>oops</html>", { status: 200 })));

    expect(await readFailureKind(fetchProducts())).toBe("unexpected");
  });

  it.each([401, 404, 429])("reports a %i answer as unexpected", async (status) => {
    stubFetch(() => Promise.resolve(problemResponse(status)));

    expect(await readFailureKind(fetchProducts())).toBe("unexpected");
  });

  it.each([500, 503])("reports a %i problem+json answer as a server error", async (status) => {
    stubFetch(() => Promise.resolve(problemResponse(status)));

    expect(await readFailureKind(fetchProducts())).toBe("server");
  });

  it("carries nothing of the response body in the error", async () => {
    stubFetch(() => Promise.resolve(problemResponse(500)));

    const error = await fetchProducts().catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(CatalogueError);
    expect(JSON.stringify(error)).not.toContain("SECRET");
    expect((error as CatalogueError).message).not.toContain("SECRET");
  });

  it("reports a 500 whose body is not JSON as a server error", async () => {
    stubFetch(() => Promise.resolve(new Response("oops", { status: 500 })));

    expect(await readFailureKind(fetchProducts())).toBe("server");
  });

  it("reports a network failure", async () => {
    stubFetch(() => Promise.reject(new TypeError("Failed to fetch")));

    expect(await readFailureKind(fetchProducts())).toBe("network");
  });

  it("reports a timeout after 10 seconds without answer", async () => {
    stubFetch(pendingUntilAborted);
    const outcome = readFailureKind(fetchProducts());

    await vi.advanceTimersByTimeAsync(10_000);

    expect(await outcome).toBe("timeout");
  });

  it("does not abort the request before 10 seconds", async () => {
    const stub = stubFetch(pendingUntilAborted);
    const outcome = readFailureKind(fetchProducts());

    await vi.advanceTimersByTimeAsync(9_999);
    const isAbortedEarly = stub.mock.calls[0]?.[1]?.signal?.aborted;
    await vi.advanceTimersByTimeAsync(1);

    expect(isAbortedEarly).toBe(false);
    expect(await outcome).toBe("timeout");
  });

  it("aborts the request when the caller aborts, and reports no catalogue error", async () => {
    const stub = stubFetch(pendingUntilAborted);
    const controller = new AbortController();
    const outcome = readFailureKind(fetchProducts(controller.signal));

    controller.abort();

    const result = await outcome;
    expect(stub.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
    expect(result).toBeInstanceOf(DOMException);
  });

  it("rejects with the abort, not a catalogue error, when the signal is already aborted", async () => {
    stubFetch(pendingUntilAborted);

    const result = await readFailureKind(fetchProducts(AbortSignal.abort()));

    expect(result).toBeInstanceOf(DOMException);
  });

  it.each([
    ["an answer", () => Promise.resolve(jsonResponse({ products: [] }))],
    ["a server error", () => Promise.resolve(problemResponse(500))],
    ["a network failure", () => Promise.reject(new TypeError("Failed to fetch"))],
  ])("clears its timer after %s", async (_label, respond) => {
    stubFetch(respond);

    await readFailureKind(fetchProducts());

    expect(vi.getTimerCount()).toBe(0);
  });

  it("clears its timer after an abort", async () => {
    stubFetch(pendingUntilAborted);
    const controller = new AbortController();
    const outcome = readFailureKind(fetchProducts(controller.signal));

    controller.abort();
    await outcome;

    expect(vi.getTimerCount()).toBe(0);
  });
});
