import { afterEach, describe, expect, it, vi } from "vitest";

import { buildDeliveryQuote } from "../../../test-support/builders/build-delivery-quote";
import { jsonResponse, problemResponse, stubFetch } from "../../../test-support/stubs/stub-fetch";

import { fetchDeliveryQuote } from "./fetch-delivery-quote";

const REQUEST = { latitude: -18.912346, longitude: 47.512346, pieces: 3 };

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchDeliveryQuote", () => {
  it("POSTs the point and the pieces as JSON, with no referrer and no redirect, to a fixed address", async () => {
    const quote = buildDeliveryQuote();
    const stub = stubFetch(() => Promise.resolve(jsonResponse(quote)));

    expect(await fetchDeliveryQuote(REQUEST)).toStrictEqual(quote);

    const [address, init] = stub.mock.calls[0] ?? [];
    expect(address).toBe("/api/v1/delivery/quote");
    expect(init).toMatchObject({
      method: "POST",
      body: JSON.stringify(REQUEST),
      credentials: "omit",
      referrerPolicy: "no-referrer",
      redirect: "error",
    });
    expect(new Headers(init?.headers).get("Content-Type")).toBe("application/json");
  });

  it("refuses an answer that is not the contract", async () => {
    stubFetch(() => Promise.resolve(jsonResponse({ ...buildDeliveryQuote(), feeAr: -1 })));

    await expect(fetchDeliveryQuote(REQUEST)).rejects.toThrow("unexpected");
  });

  it("fails on a server error without any word of the server", async () => {
    stubFetch(() => Promise.resolve(problemResponse(500)));

    await expect(fetchDeliveryQuote(REQUEST)).rejects.toThrow(
      /^Delivery quote request failed: server$/,
    );
  });
});
