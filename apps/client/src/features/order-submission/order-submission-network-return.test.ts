import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { buildDrafts } from "../../test-support/build-order-submission";
import { buildCleanup, created, status } from "../../test-support/order-submission-answers";
import { resetOrderSubmission } from "../../test-support/reset-order-submission";
import { jsonResponse, pendingUntilAborted, stubFetch } from "../../test-support/stub-fetch";

import type { OrderDrafts } from "./request/build-order-request";
import { attachOrderSubmissionHost, submitOrder } from "./order-submission";
import type { OrderCleanup } from "./order-submission";
import { PENDING_ORDER_STORAGE_ITEM } from "./storage/pending-order-storage";

beforeEach(() => {
  resetOrderSubmission();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("the replay when the network comes back", () => {
  let current: OrderDrafts;
  let steps: OrderCleanup;
  let detach: () => void;

  async function failWith(
    kind: "offline" | "network" | "timeout" | "429" | "503" | "500" | "unconfirmed",
  ) {
    vi.useFakeTimers();
    current = buildDrafts();
    steps = buildCleanup();
    detach = attachOrderSubmissionHost({ read: () => ({ drafts: current, cleanup: steps }) });
    const fetchStub = stubFetch((init) => {
      switch (kind) {
        case "network":
          return Promise.reject(new TypeError("Failed to fetch"));
        case "timeout":
          return pendingUntilAborted(init);
        case "offline":
          return Promise.resolve(created());
        case "unconfirmed":
          return Promise.resolve(jsonResponse({}, 201));
        default:
          return Promise.resolve(status(Number(kind)));
      }
    });
    if (kind === "offline") {
      vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    }
    const pending = submitOrder(current, steps);
    await vi.advanceTimersByTimeAsync(15_000);
    await pending;
    if (kind === "offline") {
      vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
    }
    return fetchStub;
  }

  it.each(["offline", "network", "timeout"] as const)(
    "happens once after %s, and only once",
    async (kind) => {
      const fetchStub = await failWith(kind);
      const before = fetchStub.mock.calls.length;
      fetchStub.mockImplementation(() => Promise.resolve(status(503)));

      window.dispatchEvent(new Event("online"));
      await vi.advanceTimersByTimeAsync(0);
      window.dispatchEvent(new Event("online"));
      await vi.advanceTimersByTimeAsync(0);

      expect(fetchStub.mock.calls.length - before).toBe(1);
    },
  );

  it.each(["429", "503", "500", "unconfirmed"] as const)(
    "never happens after a %s",
    async (kind) => {
      const fetchStub = await failWith(kind);
      const before = fetchStub.mock.calls.length;

      window.dispatchEvent(new Event("online"));
      await vi.advanceTimersByTimeAsync(0);

      expect(fetchStub.mock.calls.length).toBe(before);
    },
  );

  it("sends nothing and clears nothing when a draft changed since the failure", async () => {
    const fetchStub = await failWith("network");
    const before = fetchStub.mock.calls.length;
    current = buildDrafts({ landmark: "Portail rouge" });
    fetchStub.mockImplementation(() => Promise.resolve(created()));

    window.dispatchEvent(new Event("online"));
    await vi.advanceTimersByTimeAsync(0);

    expect(fetchStub.mock.calls.length).toBe(before);
    expect(steps.clearDrafts).not.toHaveBeenCalled();
    expect(steps.clearCart).not.toHaveBeenCalled();
    expect(sessionStorage.getItem(PENDING_ORDER_STORAGE_ITEM)).not.toBeNull();
  });

  it("sends nothing when no hook is mounted any more", async () => {
    const fetchStub = await failWith("network");
    const before = fetchStub.mock.calls.length;
    fetchStub.mockImplementation(() => Promise.resolve(created()));
    detach();

    window.dispatchEvent(new Event("online"));
    await vi.advanceTimersByTimeAsync(0);

    expect(fetchStub.mock.calls.length).toBe(before);
    expect(sessionStorage.getItem(PENDING_ORDER_STORAGE_ITEM)).not.toBeNull();
  });
});
