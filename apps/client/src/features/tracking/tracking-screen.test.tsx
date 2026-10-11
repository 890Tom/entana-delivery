import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { texts } from "../../i18n/texts";
import { resetOrderSubmission } from "../../test-support/reset-order-submission";
import {
  OTHER_TOKEN,
  TOKEN,
  TRACKING_ADDRESS,
  inSequence,
  networkFailure,
  openTracking,
  problemAnswer,
  sentHeaders,
  storedOrders,
  viewAnswer,
} from "../../test-support/tracking-harness";

beforeEach(() => {
  resetOrderSubmission();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  window.history.replaceState({}, "", "/");
  document.title = "";
});

describe("the order that is shown", () => {
  it("reads the token of the link, erases it from the address and remembers the order", async () => {
    const app = openTracking({ hash: `#${TOKEN}` });

    await screen.findAllByText(texts.tracking.awaitingConfirmation);

    expect(`${window.location.pathname}${window.location.search}${window.location.hash}`).toBe(
      "/suivi",
    );
    expect(sentHeaders(app.callsTo(TRACKING_ADDRESS)[0]).get("X-Tracking-Token")).toBe(TOKEN);
    await waitFor(() => {
      expect(storedOrders().map((order) => order.code)).toEqual(["K7M2QX"]);
    });
  });

  it("says not found for a fragment that is not a token, whatever the device remembers", async () => {
    const app = openTracking({
      hash: "#not-a-token",
      stored: [{ code: "AAAAAA", token: TOKEN }],
    });

    expect(await screen.findByText(texts.tracking.notFound.title)).toBeTruthy();
    expect(screen.getByRole("link", { name: texts.tracking.viewCatalogue })).toBeTruthy();
    expect(window.location.hash).toBe("");
    expect(app.callsTo(TRACKING_ADDRESS)).toHaveLength(0);
    expect(storedOrders().map((order) => order.code)).toEqual(["AAAAAA"]);
  });

  it("shows the most recent order of the device when there is no fragment", async () => {
    const app = openTracking({
      stored: [
        { code: "AAAAAA", token: OTHER_TOKEN },
        { code: "BBBBBB", token: TOKEN },
      ],
    });

    await screen.findAllByText(texts.tracking.awaitingConfirmation);

    expect(sentHeaders(app.callsTo(TRACKING_ADDRESS)[0]).get("X-Tracking-Token")).toBe(OTHER_TOKEN);
  });

  it("says that no order is remembered, and leads to the catalogue", async () => {
    const app = openTracking();

    expect(await screen.findByText(texts.tracking.empty)).toBeTruthy();
    expect(
      screen.getByRole("link", { name: texts.tracking.viewCatalogue }).getAttribute("href"),
    ).toBe("/");
    expect(app.callsTo(TRACKING_ADDRESS)).toHaveLength(0);
  });

  it("titles the document with the shop and asks not to be indexed while shown", async () => {
    openTracking({ stored: [{ code: "AAAAAA", token: TOKEN }] });

    await screen.findAllByText(texts.tracking.awaitingConfirmation);

    await waitFor(() => {
      expect(document.title).toBe("Suivi — Maison Démo");
    });
    expect(document.head.querySelector('meta[name="robots"]')?.getAttribute("content")).toBe(
      "noindex",
    );
    cleanup();
    expect(document.head.querySelector('meta[name="robots"]')).toBeNull();
  });
});

describe("the request", () => {
  it("carries the token header only, no credentials, no cache and no referrer", async () => {
    const app = openTracking({ stored: [{ code: "AAAAAA", token: TOKEN }] });

    await screen.findAllByText(texts.tracking.awaitingConfirmation);

    const init = app.callsTo(TRACKING_ADDRESS)[0]?.[1];
    expect([...new Headers(init?.headers).keys()]).toEqual(["x-tracking-token"]);
    expect(init).toMatchObject({
      method: "GET",
      credentials: "omit",
      cache: "no-store",
      referrerPolicy: "no-referrer",
    });
  });
});

describe("an order that cannot be read", () => {
  it("says it is not found and forgets the entry, even one taken from the device's list", async () => {
    openTracking({
      stored: [{ code: "AAAAAA", token: TOKEN }],
      tracking: problemAnswer(404),
    });

    expect(await screen.findByText(texts.tracking.notFound.title)).toBeTruthy();
    expect(
      within(screen.getByRole("main"))
        .getByRole("link", { name: texts.findOrder.entry })
        .getAttribute("href"),
    ).toBe("/retrouver");
    await waitFor(() => {
      expect(storedOrders()).toEqual([]);
    });
    expect(document.body.textContent).not.toContain("SECRET");
  });

  it("is not asked for again after a 404", async () => {
    const app = openTracking({
      stored: [{ code: "AAAAAA", token: TOKEN }],
      tracking: problemAnswer(404),
    });

    await screen.findByText(texts.tracking.notFound.title);

    expect(app.callsTo(TRACKING_ADDRESS)).toHaveLength(1);
  });

  it("keeps the last reading and says so when a refresh fails", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    openTracking({
      stored: [{ code: "AAAAAA", token: TOKEN }],
      tracking: inSequence(viewAnswer(), networkFailure),
    });
    await screen.findAllByText(texts.tracking.awaitingConfirmation);

    await vi.advanceTimersByTimeAsync(30_000 + 20_000);

    expect(await screen.findByText(texts.tracking.refreshFailed)).toBeTruthy();
    expect(screen.getAllByText(texts.tracking.awaitingConfirmation).length).toBeGreaterThan(0);
    vi.useRealTimers();
  });

  it("shows a red notice with a retry when there is nothing to show yet", async () => {
    openTracking({
      stored: [{ code: "AAAAAA", token: TOKEN }],
      tracking: inSequence(
        problemAnswer(503),
        problemAnswer(503),
        problemAnswer(503),
        viewAnswer(),
      ),
    });

    const retry = await screen.findByRole(
      "button",
      { name: texts.common.retry },
      { timeout: 8000 },
    );
    expect(screen.getByText(texts.tracking.loadFailed)).toBeTruthy();
    fireEvent.click(retry);

    expect(
      (await screen.findAllByText(texts.tracking.awaitingConfirmation)).length,
    ).toBeGreaterThan(0);
  }, 15000);
});
