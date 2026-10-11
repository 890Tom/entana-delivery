import { cleanup, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { texts } from "../../i18n/texts";
import { resetOrderSubmission } from "../../test-support/order-submission/reset-order-submission";
import {
  TOKEN,
  TRACKING_ADDRESS,
  inSequence,
  openTracking,
  viewAnswer,
} from "../../test-support/harnesses/tracking-harness";

import { TRACKING_REFRESH_INTERVAL_MS } from "./api/use-tracking";

const STORED = [{ code: "AAAAAA", token: TOKEN }];

beforeEach(() => {
  resetOrderSubmission();
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  window.history.replaceState({}, "", "/");
});

describe("the refresh", () => {
  it("reads the order again every interval while it goes on, and announces a change only", async () => {
    const app = openTracking({
      stored: STORED,
      tracking: inSequence(
        viewAnswer(),
        viewAnswer(),
        viewAnswer({ status: "CONFIRMED", deliveryDate: "2026-10-02" }),
      ),
    });
    await screen.findAllByText(texts.tracking.awaitingConfirmation);
    const announcements = (): string =>
      [...document.querySelectorAll('[aria-live="polite"]')]
        .map((node) => node.textContent)
        .join("");
    expect(announcements()).toBe("");

    await vi.advanceTimersByTimeAsync(TRACKING_REFRESH_INTERVAL_MS + 100);
    expect(app.callsTo(TRACKING_ADDRESS)).toHaveLength(2);
    expect(announcements()).toBe("");

    await vi.advanceTimersByTimeAsync(TRACKING_REFRESH_INTERVAL_MS);
    expect(app.callsTo(TRACKING_ADDRESS)).toHaveLength(3);
    expect(announcements()).toBe("Livraison le vendredi 2 octobre");
  });

  it("stops once the order is finished", async () => {
    const app = openTracking({
      stored: STORED,
      tracking: viewAnswer({ status: "DELIVERED", canCancel: false }),
    });
    await screen.findAllByText(texts.tracking.delivered.title);

    await vi.advanceTimersByTimeAsync(TRACKING_REFRESH_INTERVAL_MS * 3);

    expect(app.callsTo(TRACKING_ADDRESS)).toHaveLength(1);
  });
});
