import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { buildDrafts } from "../../test-support/build-order-submission";
import { buildCleanup, created, status } from "../../test-support/order-submission-answers";
import { resetOrderSubmission } from "../../test-support/reset-order-submission";
import { jsonResponse, stubFetch } from "../../test-support/stub-fetch";

import { CONFIRMED_ORDERS_STORAGE_KEY } from "./confirmed-orders-storage";
import {
  dismissOrderSubmission,
  getOrderSubmissionState,
  retryOrder,
  submitOrder,
} from "./order-submission";
import { PENDING_ORDER_STORAGE_ITEM } from "./pending-order-storage";

const cleanup = buildCleanup;

/** What a request carried: the key, and the body that holds the token. */
const sentOf = (init: RequestInit | undefined): { key: unknown; body: unknown } => ({
  key: (init?.headers as Record<string, string>)["Idempotency-Key"],
  body: init?.body,
});

beforeEach(() => {
  resetOrderSubmission();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("a confirmed order", () => {
  it("is recorded, then the attempt dropped, then the drafts and the cart cleared, then published", async () => {
    stubFetch(() => Promise.resolve(created()));
    const seen: string[] = [];
    const steps = {
      clearDrafts: vi.fn(() => {
        seen.push(
          `drafts:${String(localStorage.getItem(CONFIRMED_ORDERS_STORAGE_KEY) !== null)}:${String(sessionStorage.getItem(PENDING_ORDER_STORAGE_ITEM) === null)}`,
        );
      }),
      clearCart: vi.fn(() => {
        seen.push("cart");
      }),
    };

    const result = await submitOrder(buildDrafts(), steps);

    expect(seen).toEqual(["drafts:true:true", "cart"]);
    expect(result).toEqual({
      status: "confirmed",
      orderCode: "K7M2QX",
      totalAr: 9000,
      createdAt: "2026-10-10T08:30:00.000Z",
    });
    expect(getOrderSubmissionState()).toEqual(result);
  });

  it("is published with its code even when no storage works", async () => {
    stubFetch(() => Promise.resolve(created()));
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("full", "QuotaExceededError");
    });
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new DOMException("denied", "SecurityError");
    });
    const steps = cleanup();

    const result = await submitOrder(buildDrafts(), steps);

    expect(result).toMatchObject({ status: "confirmed", orderCode: "K7M2QX" });
    expect(steps.clearDrafts).toHaveBeenCalledOnce();
    expect(steps.clearCart).toHaveBeenCalledOnce();
  });

  it("is recorded even when the component that asked has gone", async () => {
    let answer: (response: Response) => void = () => undefined;
    stubFetch(
      () =>
        new Promise<Response>((resolve) => {
          answer = resolve;
        }),
    );
    const steps = cleanup();

    const pending = submitOrder(buildDrafts(), steps);
    // Nothing holds the result: the caller is gone.
    answer(created());
    await pending;

    expect(localStorage.getItem(CONFIRMED_ORDERS_STORAGE_KEY)).toContain("K7M2QX");
    expect(steps.clearCart).toHaveBeenCalledOnce();
  });
});

describe("one send at a time", () => {
  it("answers a second call during a send with the same result, without a new request", async () => {
    const fetchStub = stubFetch(() => Promise.resolve(created()));

    const [first, second] = await Promise.all([
      submitOrder(buildDrafts(), cleanup()),
      submitOrder(buildDrafts(), cleanup()),
    ]);

    expect(fetchStub).toHaveBeenCalledOnce();
    expect(second).toBe(first);
  });
});

describe("the attempt of a replayable failure", () => {
  it("stays stored and is replayed identically: same key, same token, same body", async () => {
    const fetchStub = stubFetch(() => Promise.reject(new TypeError("Failed to fetch")));
    await submitOrder(buildDrafts(), cleanup());
    expect(sessionStorage.getItem(PENDING_ORDER_STORAGE_ITEM)).not.toBeNull();
    fetchStub.mockImplementation(() => Promise.resolve(created()));

    const result = await retryOrder(cleanup());

    expect(result.status).toBe("confirmed");
    expect(sentOf(fetchStub.mock.calls[1]?.[1])).toEqual(sentOf(fetchStub.mock.calls[0]?.[1]));
  });
});

describe("the attempt of a definitive failure", () => {
  it("is dropped, and the next send has a new key and a new token", async () => {
    const fetchStub = stubFetch(() => Promise.resolve(status(409)));
    await submitOrder(buildDrafts(), cleanup());
    expect(sessionStorage.getItem(PENDING_ORDER_STORAGE_ITEM)).toBeNull();

    await submitOrder(buildDrafts(), cleanup());

    const [first, second] = [0, 1].map((call) => sentOf(fetchStub.mock.calls[call]?.[1]));
    expect(second?.key).not.toBe(first?.key);
    expect(second?.body).not.toBe(first?.body);
  });
});

describe("the reuse of an attempt", () => {
  it("keeps the key and the token when the drafts did not change", async () => {
    const fetchStub = stubFetch(() => Promise.resolve(status(503)));
    await submitOrder(buildDrafts(), cleanup());

    await submitOrder(buildDrafts(), cleanup());

    expect(sentOf(fetchStub.mock.calls[1]?.[1])).toEqual(sentOf(fetchStub.mock.calls[0]?.[1]));
  });

  it("makes a new key and a new token when a draft changed", async () => {
    const fetchStub = stubFetch(() => Promise.resolve(status(503)));
    await submitOrder(buildDrafts(), cleanup());

    await submitOrder(buildDrafts({ landmark: "Portail rouge" }), cleanup());

    const [first, second] = [0, 1].map((call) => sentOf(fetchStub.mock.calls[call]?.[1]));
    expect(second?.key).not.toBe(first?.key);
  });
});

describe("the draft that cannot be sent", () => {
  it("sends nothing and names the faulty fields", async () => {
    const fetchStub = stubFetch(() => Promise.resolve(created()));

    const result = await submitOrder(buildDrafts({ point: null }), cleanup());

    expect(fetchStub).not.toHaveBeenCalled();
    expect(result).toEqual({
      status: "error",
      error: { type: "invalid_draft", fields: ["location"] },
    });
  });
});

describe("an unreadable 2xx", () => {
  it("keeps the attempt, and a retry sends the same key, token and body", async () => {
    const fetchStub = stubFetch(() => Promise.resolve(jsonResponse({ orderCode: "x" }, 201)));
    const result = await submitOrder(buildDrafts(), cleanup());
    expect(result).toEqual({ status: "error", error: { type: "unconfirmed" } });
    expect(sessionStorage.getItem(PENDING_ORDER_STORAGE_ITEM)).not.toBeNull();
    fetchStub.mockImplementation(() => Promise.resolve(created()));

    const retried = await retryOrder(cleanup());

    expect(retried.status).toBe("confirmed");
    expect(sentOf(fetchStub.mock.calls[1]?.[1])).toEqual(sentOf(fetchStub.mock.calls[0]?.[1]));
  });
});

describe("dismissing the result", () => {
  it("returns a failure to idle", async () => {
    stubFetch(() => Promise.resolve(status(409)));
    await submitOrder(buildDrafts(), cleanup());

    dismissOrderSubmission();

    expect(getOrderSubmissionState()).toEqual({ status: "idle" });
  });

  it("changes nothing during a send", async () => {
    let answer: (response: Response) => void = () => undefined;
    stubFetch(
      () =>
        new Promise<Response>((resolve) => {
          answer = resolve;
        }),
    );
    const pending = submitOrder(buildDrafts(), cleanup());

    dismissOrderSubmission();

    expect(getOrderSubmissionState()).toEqual({ status: "sending" });
    answer(created());
    await pending;
  });

  it("returns a confirmed order to idle", async () => {
    stubFetch(() => Promise.resolve(created()));
    await submitOrder(buildDrafts(), cleanup());

    dismissOrderSubmission();

    expect(getOrderSubmissionState()).toEqual({ status: "idle" });
  });
});

describe("the clock", () => {
  it("decides which confirmed orders are expired, without any fake timer", async () => {
    const old = { code: "AAAAAA", token: "B".repeat(43), createdAt: "2026-01-01T00:00:00.000Z" };
    localStorage.setItem(
      CONFIRMED_ORDERS_STORAGE_KEY,
      JSON.stringify({ version: 1, orders: [old] }),
    );
    stubFetch(() => Promise.resolve(status(409)));

    await submitOrder(buildDrafts(), cleanup(), () => Date.parse("2026-10-10T00:00:00.000Z"));

    expect(JSON.parse(localStorage.getItem(CONFIRMED_ORDERS_STORAGE_KEY) ?? "null")).toEqual({
      version: 1,
      orders: [],
    });
  });
});

describe("what leaves the page", () => {
  it("holds no personal data, token or code in the console, the addresses or other requests", async () => {
    const consoleCalls = (["log", "info", "warn", "error", "debug"] as const).map((method) =>
      vi.spyOn(console, method).mockImplementation(() => undefined),
    );
    const fetchStub = stubFetch(() => Promise.resolve(status(503)));
    await submitOrder(buildDrafts(), cleanup());
    fetchStub.mockImplementation(() => Promise.resolve(created()));
    await retryOrder(cleanup());

    const sentBody = fetchStub.mock.calls[0]?.[1]?.body;
    const token = /"trackingToken":"([^"]+)"/.exec(
      typeof sentBody === "string" ? sentBody : "",
    )?.[1];
    expect(token).toHaveLength(43);
    const outside = JSON.stringify([
      consoleCalls.map((spy) => spy.mock.calls),
      window.location.href,
      fetchStub.mock.calls.map((call) => call[0]),
    ]);
    expect(outside).not.toContain(token ?? "");
    expect(outside).not.toMatch(/K7M2QX|Rakoto|Portail|341234567|18\.91|47\.51/);
    expect(new Set(fetchStub.mock.calls.map((call) => call[0]))).toEqual(
      new Set(["/api/v1/orders"]),
    );
    const confirmed = localStorage.getItem(CONFIRMED_ORDERS_STORAGE_KEY) ?? "";
    expect(confirmed).not.toMatch(/Rakoto|Portail|341234567|18\.91|47\.51/);
  });
});
