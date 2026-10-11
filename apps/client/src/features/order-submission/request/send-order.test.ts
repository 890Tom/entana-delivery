import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { buildAttempt, CREATED_BODY } from "../../../test-support/builders/build-order-submission";
import { buildProductId } from "../../../test-support/builders/build-product";
import {
  jsonResponse,
  pendingUntilAborted,
  stubFetch,
} from "../../../test-support/stubs/stub-fetch";

import { sendOrder } from "./send-order";

const SENT_ID = buildProductId(1);
const OTHER_ID = buildProductId(9);

function problem(status: number, extra: Record<string, unknown> = {}): Response {
  return jsonResponse(
    {
      type: "about:blank",
      title: "SECRET-TITLE",
      status,
      detail: "SECRET-DETAIL",
      instance: "/api/v1/orders",
      ...extra,
    },
    status,
  );
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("the request of an order", () => {
  it("is a POST to the relative address with the key and the body, and nothing else", async () => {
    const fetchStub = stubFetch(() => Promise.resolve(jsonResponse(CREATED_BODY, 201)));
    const attempt = buildAttempt();

    await sendOrder(attempt);

    const [address, init] = fetchStub.mock.calls[0] ?? [];
    expect(address).toBe("/api/v1/orders");
    expect(init?.method).toBe("POST");
    expect(init?.credentials).toBe("omit");
    expect(init?.redirect).toBe("error");
    expect(init?.headers).toEqual({
      "Content-Type": "application/json",
      "Idempotency-Key": attempt.key,
    });
    expect(init?.body).toBe(JSON.stringify(attempt.request));
  });
});

describe("the answer to an order", () => {
  it("confirms a 201 with the code, the total and the creation instant only", async () => {
    stubFetch(() => Promise.resolve(jsonResponse(CREATED_BODY, 201)));

    expect(await sendOrder(buildAttempt())).toEqual({
      status: "confirmed",
      orderCode: "K7M2QX",
      totalAr: 9000,
      createdAt: "2026-10-10T08:30:00.000Z",
    });
  });

  it("confirms a replayed 201 like a first one", async () => {
    stubFetch(() =>
      Promise.resolve(
        new Response(JSON.stringify(CREATED_BODY), {
          status: 201,
          headers: { "Idempotent-Replayed": "true" },
        }),
      ),
    );

    expect((await sendOrder(buildAttempt())).status).toBe("confirmed");
  });

  it.each([
    [
      "400, keeping the known fields only",
      () =>
        problem(400, {
          errors: [
            { pointer: "/phone", detail: "x" },
            { pointer: "/items/0/quantity", detail: "x" },
            { pointer: "/somethingElse", detail: "x" },
          ],
        }),
      { type: "validation", fields: ["phone", "items"] },
    ],
    ["403", () => problem(403), { type: "blocked" }],
    ["409", () => problem(409), { type: "conflict" }],
    [
      "422 with product ids, the ones that were sent",
      () =>
        problem(422, {
          productIds: [SENT_ID, OTHER_ID],
        }),
      { type: "unavailable_products", productIds: [SENT_ID] },
    ],
    ["422 without product ids", () => problem(422), { type: "order_too_large" }],
    ["429", () => problem(429), { type: "rate_limited" }],
    ["503", () => problem(503), { type: "service_unavailable" }],
    ["500", () => problem(500), { type: "server" }],
    ["413", () => problem(413), { type: "unexpected" }],
    ["415", () => problem(415), { type: "unexpected" }],
    [
      "a 201 whose body is not the contract's",
      () => jsonResponse({ orderCode: "x" }, 201),
      { type: "unconfirmed" },
    ],
    [
      "a 201 that is not JSON",
      () => new Response("<html>", { status: 201 }),
      { type: "unconfirmed" },
    ],
    ["a 200", () => jsonResponse(CREATED_BODY, 200), { type: "unconfirmed" }],
  ])("is classified from the status and the known fields: %s", async (_label, answer, expected) => {
    stubFetch(() => Promise.resolve(answer()));

    const result = await sendOrder(buildAttempt());

    expect(result).toEqual({ status: "error", error: expected });
    expect(JSON.stringify(result)).not.toMatch(/SECRET/);
  });

  it("is a network error when the request fails", async () => {
    stubFetch(() => Promise.reject(new TypeError("Failed to fetch")));

    expect(await sendOrder(buildAttempt())).toEqual({
      status: "error",
      error: { type: "network" },
    });
  });

  it("is a timeout when nothing comes back in 15 seconds", async () => {
    vi.useFakeTimers();
    stubFetch(pendingUntilAborted);

    const result = sendOrder(buildAttempt());
    await vi.advanceTimersByTimeAsync(15_000);

    expect(await result).toEqual({ status: "error", error: { type: "timeout" } });
  });

  it("is offline, with no request, when the browser says so", async () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    const fetchStub = stubFetch(() => Promise.resolve(jsonResponse(CREATED_BODY, 201)));

    expect(await sendOrder(buildAttempt())).toEqual({
      status: "error",
      error: { type: "offline" },
    });
    expect(fetchStub).not.toHaveBeenCalled();
  });
});

beforeEach(() => {
  vi.restoreAllMocks();
});
