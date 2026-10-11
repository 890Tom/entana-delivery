import type { TrackingResponse } from "@entana/contracts";
import { afterEach, describe, expect, it, vi } from "vitest";

import { jsonResponse, problemResponse } from "../../../test-support/stubs/stub-fetch";

import { lookupOrder } from "./request-lookup";

const REQUEST = { phone: "+261341234567", orderCode: "K7M2QX" };
const VIEW: TrackingResponse = {
  orderCode: "K7M2QX",
  status: "NEW",
  deliveryDate: null,
  landmarkText: "Portail bleu",
  totalAr: 3200,
  deliveryFeeAr: 1000,
  itemCount: 1,
  createdAt: "2026-10-01T08:00:00.000Z",
  rejectionReason: null,
  canCancel: false,
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function answerWith(response: () => Promise<Response>): ReturnType<typeof vi.fn> {
  const stub = vi.fn(response);
  vi.stubGlobal("fetch", stub);
  return stub;
}

describe("looking an order up", () => {
  it("posts the values in the body only, without credentials, referrer or redirect", async () => {
    const stub = answerWith(() => Promise.resolve(jsonResponse(VIEW)));

    const result = await lookupOrder(REQUEST);

    const [address, init] = stub.mock.calls[0] as [string, RequestInit];
    expect(result).toStrictEqual({ kind: "ok", view: VIEW });
    expect(address).toBe("/api/v1/tracking/lookup");
    expect(init).toMatchObject({
      method: "POST",
      body: JSON.stringify(REQUEST),
      credentials: "omit",
      referrerPolicy: "no-referrer",
      redirect: "error",
    });
  });

  it.each([
    [400, "invalid_phone"],
    [404, "not_found"],
    [429, "rate_limited"],
    [500, "failure"],
    [503, "failure"],
  ])("tells an answer %i as %s, never with the text of the server", async (status, kind) => {
    answerWith(() => Promise.resolve(problemResponse(status)));

    expect(await lookupOrder(REQUEST)).toStrictEqual({ kind });
  });

  it("tells a connection that fails as a failure, and asks once", async () => {
    const stub = answerWith(() => Promise.reject(new TypeError("Failed to fetch")));

    expect(await lookupOrder(REQUEST)).toStrictEqual({ kind: "failure" });
    expect(stub).toHaveBeenCalledOnce();
  });

  it("tells an answer outside the schema as a failure", async () => {
    answerWith(() => Promise.resolve(jsonResponse({ ...VIEW, status: "UNKNOWN" })));

    expect(await lookupOrder(REQUEST)).toStrictEqual({ kind: "failure" });
  });

  it("gives up on a request that does not answer within ten seconds", async () => {
    vi.useFakeTimers();
    answerWith(() => new Promise<Response>(() => undefined));
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_address: string, init: RequestInit) =>
          new Promise<Response>((_resolve, reject) => {
            init.signal?.addEventListener("abort", () => {
              reject(new DOMException("Aborted", "AbortError"));
            });
          }),
      ),
    );

    const pending = lookupOrder(REQUEST);
    await vi.advanceTimersByTimeAsync(10_000);

    expect(await pending).toStrictEqual({ kind: "failure" });
  });
});
