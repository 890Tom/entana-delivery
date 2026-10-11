import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { texts } from "../../i18n/texts";
import { resetOrderSubmission } from "../../test-support/reset-order-submission";
import {
  CANCEL_ADDRESS,
  TOKEN,
  cancelButton,
  inSequence,
  networkFailure,
  openTracking,
  problemAnswer,
  sentHeaders,
  viewAnswer,
} from "../../test-support/tracking-harness";

const STORED = [{ code: "AAAAAA", token: TOKEN }];
const { cancelPanel } = texts.tracking;

beforeEach(() => {
  resetOrderSubmission();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.history.replaceState({}, "", "/");
});

/** Opens the question: the first step of a cancellation. */
async function ask(
  options: Parameters<typeof openTracking>[0] = {},
): Promise<ReturnType<typeof openTracking>> {
  const app = openTracking({ stored: STORED, ...options });
  fireEvent.click(await cancelButton());
  return app;
}

describe("cancelling an order", () => {
  it("asks first, with no dialog, and keeps the order when the customer keeps it", async () => {
    const app = await ask();

    const panel = screen.getByRole("group", { name: cancelPanel.title });
    expect(document.activeElement).toBe(within(panel).getByText(cancelPanel.title));
    expect(screen.queryByRole("alertdialog")).toBeNull();

    fireEvent.keyDown(panel, { key: "Escape" });

    expect(screen.queryByRole("group", { name: cancelPanel.title })).toBeNull();
    expect(document.activeElement).toBe(await cancelButton());
    expect(app.callsTo(CANCEL_ADDRESS)).toHaveLength(0);
  });

  it("posts with the token header and no body, then replaces the view with the answer", async () => {
    const app = await ask();

    fireEvent.click(screen.getByRole("button", { name: cancelPanel.confirm }));

    expect((await screen.findAllByText(texts.tracking.cancelled.title)).length).toBeGreaterThan(0);
    // The button that had the focus is gone: the focus is on the title of the new status.
    await waitFor(() => {
      expect(document.activeElement?.tagName).toBe("H1");
    });
    expect(document.activeElement?.textContent).toBe(texts.tracking.cancelled.title);
    const call = app.callsTo(CANCEL_ADDRESS)[0];
    expect(call?.[1]?.method).toBe("POST");
    expect(call?.[1]?.body).toBeUndefined();
    expect(sentHeaders(call).get("X-Tracking-Token")).toBe(TOKEN);
    expect(screen.queryByRole("button", { name: texts.tracking.actions.cancel })).toBeNull();
  });

  it("sends one request for a double click", async () => {
    const app = await ask({ cancel: () => new Promise(() => undefined) });
    const confirm = screen.getByRole("button", { name: cancelPanel.confirm });

    fireEvent.click(confirm);
    fireEvent.click(confirm);

    await waitFor(() => {
      expect(app.callsTo(CANCEL_ADDRESS)).toHaveLength(1);
    });
    expect(confirm.getAttribute("aria-disabled")).toBe("true");
    expect(confirm.hasAttribute("disabled")).toBe(false);
  });

  it("refreshes the order and says it can no longer be cancelled after a 409", async () => {
    const app = await ask({
      cancel: problemAnswer(409),
      tracking: inSequence(
        viewAnswer(),
        viewAnswer({ status: "OUT_FOR_DELIVERY", canCancel: false }),
      ),
    });

    fireEvent.click(screen.getByRole("button", { name: cancelPanel.confirm }));

    expect(await screen.findByText(texts.tracking.cancelErrors.conflict)).toBeTruthy();
    await waitFor(() => {
      expect(screen.queryByRole("button", { name: texts.tracking.actions.cancel })).toBeNull();
    });
    expect(app.callsTo("/api/v1/tracking")).toHaveLength(2);
  });

  it("says it failed after a network error and replays the same request on retry", async () => {
    const app = await ask({
      cancel: inSequence(networkFailure, viewAnswer({ status: "CANCELLED", canCancel: false })),
    });

    fireEvent.click(screen.getByRole("button", { name: cancelPanel.confirm }));
    const notice = await screen.findByRole("alert");
    expect(notice.textContent).toContain(texts.tracking.cancelErrors.failed);
    fireEvent.click(within(notice).getByRole("button", { name: texts.common.retry }));

    expect((await screen.findAllByText(texts.tracking.cancelled.title)).length).toBeGreaterThan(0);
    expect(app.callsTo(CANCEL_ADDRESS)).toHaveLength(2);
  });

  it("does not offer to keep the order once the request is sent", async () => {
    await ask({ cancel: () => new Promise(() => undefined) });
    const panel = screen.getByRole("group", { name: cancelPanel.title });
    fireEvent.click(within(panel).getByRole("button", { name: cancelPanel.confirm }));

    await waitFor(() => {
      expect(
        within(panel).getByRole("button", { name: cancelPanel.keep }).getAttribute("aria-disabled"),
      ).toBe("true");
    });
    fireEvent.keyDown(panel, { key: "Escape" });
    fireEvent.click(within(panel).getByRole("button", { name: cancelPanel.keep }));

    expect(screen.getByRole("group", { name: cancelPanel.title })).toBeTruthy();
  });

  it("shows the order as not found when it is gone by the time it is cancelled", async () => {
    await ask({
      cancel: problemAnswer(404),
      tracking: inSequence(viewAnswer(), problemAnswer(404)),
    });

    fireEvent.click(screen.getByRole("button", { name: cancelPanel.confirm }));

    expect(await screen.findByText(texts.tracking.notFound.title)).toBeTruthy();
  });
});
