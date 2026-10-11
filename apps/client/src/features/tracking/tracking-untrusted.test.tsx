import { cleanup, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { texts } from "../../i18n/texts";
import { expectNoAccessibilityViolations } from "../../test-support/assertions/expect-no-accessibility-violations";
import { resetOrderSubmission } from "../../test-support/order-submission/reset-order-submission";
import {
  TOKEN,
  TRACKING_ADDRESS,
  openTracking,
  viewAnswer,
} from "../../test-support/harnesses/tracking-harness";

beforeEach(() => {
  resetOrderSubmission();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  window.history.replaceState({}, "", "/");
});

describe("what the page does with what it is given", () => {
  it("shows the reason of a refusal as text, markup included", async () => {
    const reason = '<img src="x" onerror="alert(1)"><script>alert(1)</script>';
    openTracking({
      stored: [{ code: "AAAAAA", token: TOKEN }],
      tracking: viewAnswer({ status: "REJECTED", canCancel: false, rejectionReason: reason }),
    });

    const text = await screen.findByText(texts.tracking.rejected.reason(reason));

    expect(text.children).toHaveLength(0);
    expect(document.querySelectorAll("img, script, [onerror]")).toHaveLength(0);
  });

  it("holds the token in no text, attribute, address or console line once it is read", async () => {
    const consoleCalls = (["log", "info", "warn", "error", "debug"] as const).map((method) =>
      vi.spyOn(console, method).mockImplementation(() => undefined),
    );
    const app = openTracking({ hash: `#${TOKEN}` });
    await screen.findAllByText(texts.tracking.awaitingConfirmation);
    await waitFor(() => {
      expect(window.location.hash).toBe("");
    });

    const outside = JSON.stringify([
      document.documentElement.outerHTML,
      window.location.href,
      document.title,
      consoleCalls.map((spy) => spy.mock.calls),
      app.fetchStub.mock.calls.map((call: readonly unknown[]) => call[0]),
    ]);
    expect(outside).not.toContain(TOKEN);
    expect(window.location.href).toBe(`${window.location.origin}/suivi`);
    expect(app.callsTo(TRACKING_ADDRESS)).toHaveLength(1);
  });

  it("has no accessibility violation, confirmed and finished", async () => {
    openTracking({
      stored: [{ code: "AAAAAA", token: TOKEN }],
      instance: { contactPhone: "+261341234567" },
      tracking: viewAnswer({ status: "CONFIRMED", deliveryDate: "2026-10-02" }),
    });
    await screen.findAllByText(texts.tracking.courierCalls);
    await expectNoAccessibilityViolations(document.body);

    cleanup();
    openTracking({
      stored: [{ code: "AAAAAA", token: TOKEN }],
      tracking: viewAnswer({ status: "REJECTED", canCancel: false, rejectionReason: "Hors zone" }),
    });
    await screen.findAllByText(texts.tracking.rejected.title);
    await expectNoAccessibilityViolations(document.body);
  });
});
