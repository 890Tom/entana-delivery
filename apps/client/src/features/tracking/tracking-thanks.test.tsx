import { cleanup, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { texts } from "../../i18n/texts";
import { buildDrafts } from "../../test-support/build-order-submission";
import { buildCleanup, created } from "../../test-support/order-submission-answers";
import { resetOrderSubmission } from "../../test-support/reset-order-submission";
import { openTracking } from "../../test-support/tracking-harness";
import { getOrderSubmissionState, submitOrder } from "../order-submission/order-submission";

beforeEach(() => {
  resetOrderSubmission();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.history.replaceState({}, "", "/");
});

describe("the thanks after a send", () => {
  it("is shown once, announced, and dismisses the confirmation of the sending layer", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(created())),
    );
    await submitOrder(buildDrafts(), buildCleanup());
    expect(getOrderSubmissionState().status).toBe("confirmed");

    openTracking({ keepStorage: true });

    const thanks = await screen.findByRole("status", { name: "" });
    expect(thanks.textContent).toContain(texts.tracking.thanks);
    expect(getOrderSubmissionState().status).toBe("idle");

    cleanup();
    openTracking({ keepStorage: true });

    await screen.findAllByText(texts.tracking.awaitingConfirmation);
    expect(screen.queryByText(texts.tracking.thanks)).toBeNull();
  });
});
