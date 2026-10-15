import { act, cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { texts } from "../../../i18n/texts";
import { expectNoAccessibilityViolations } from "../../../test-support/assertions/expect-no-accessibility-violations";
import { jsonResponse } from "../../../test-support/stubs/stub-fetch";
import {
  OLDER_TOKEN,
  PRODUCT,
  openApplication,
} from "../../../test-support/harnesses/launch-harness";
import { resetOrderSubmission } from "../../../test-support/order-submission/reset-order-submission";
import type { Answer } from "../../../test-support/harnesses/tracking-harness";
import {
  TOKEN,
  inSequence,
  networkFailure,
  problemAnswer,
  sentHeaders,
  viewAnswer,
} from "../../../test-support/harnesses/tracking-harness";
import { readConfirmedOrders } from "../../order-submission/storage/confirmed-orders-storage";

import { LAUNCH_CHECK_TIMEOUT_MS } from "./launch-provider";

const { activeOrder } = texts.catalogue;

/** An answer that stays pending until the test settles it with an order that goes on. */
function pendingAnswer(): { answer: Answer; settle: () => void } {
  let release: (() => void) | undefined;
  const settled = new Promise<void>((resolve) => {
    release = resolve;
  });
  return {
    answer: async () => {
      await settled;
      return viewAnswer({ status: "CONFIRMED" })();
    },
    settle: () => {
      release?.();
    },
  };
}
// The side cart repeats the name of a product in the cart: one or more.
const catalogueShown = (): Promise<HTMLElement[]> => screen.findAllByText(PRODUCT.name);
const banner = (): HTMLElement | null => screen.queryByText(activeOrder.text);

beforeEach(() => {
  resetOrderSubmission();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  window.history.replaceState({}, "", "/");
});

describe("coming back to an order that goes on", () => {
  it("leads to the tracking, replacing the opening address, with the token in a header only", async () => {
    const lengthBefore = window.history.length;
    const app = openApplication();

    await screen.findByRole("heading", { level: 1, name: texts.tracking.headingWide });

    expect(window.location.pathname).toBe("/suivi");
    expect(window.history.length).toBe(lengthBefore + 1);
    const [first] = app.trackingCalls();
    expect(first?.[0]).toBe("/api/v1/tracking");
    expect(sentHeaders(first).get("X-Tracking-Token")).toBe(TOKEN);
    expect(sessionStorage.getItem("entana.launch-handled.v1")).toBe("1");
  });

  it("asks about the most recent order only, and says nothing of an older one", async () => {
    const app = openApplication({
      stored: [
        { code: "AAAAAA", token: OLDER_TOKEN },
        { code: "BBBBBB", token: TOKEN },
      ],
      tracking: problemAnswer(404),
    });

    await catalogueShown();

    expect(app.trackingCalls()).toHaveLength(1);
    expect(sentHeaders(app.trackingCalls()[0]).get("X-Tracking-Token")).toBe(OLDER_TOKEN);
  });

  it("forgets an order the server does not know, and shows the catalogue", async () => {
    openApplication({ tracking: problemAnswer(404) });

    await catalogueShown();

    expect(readConfirmedOrders(Date.now())).toHaveLength(0);
    expect(window.location.pathname).toBe("/");
    expect(banner()).toBeNull();
  });
});

describe("staying on the catalogue", () => {
  it("does not look at the order when the application opens elsewhere, nor on the next visit to the catalogue", async () => {
    openApplication({ path: "/panier" });
    fireEvent.click(
      await screen.findByRole("link", { name: texts.shell.homeLabel("Maison Démo") }),
    );

    await catalogueShown();

    expect(window.location.pathname).toBe("/");
    expect(await screen.findByText(activeOrder.text)).toBeTruthy();
  });

  it("does not send a reload of the same tab away", async () => {
    openApplication({ isHandled: true });

    await catalogueShown();

    expect(window.location.pathname).toBe("/");
  });

  it("shows the banner and no redirect while the cart holds something, which is read at the first render", async () => {
    openApplication({ hasCart: true });

    const link = await screen.findByRole("link", { name: activeOrder.action });

    expect(link.getAttribute("href")).toBe("/suivi");
    expect(window.location.pathname).toBe("/");
    expect(await catalogueShown()).toBeTruthy();
  });

  it("shows no banner for an order that is finished", async () => {
    openApplication({
      tracking: viewAnswer({ status: "DELIVERED", canCancel: false, deliveryDate: "2026-10-02" }),
    });

    await catalogueShown();

    expect(window.location.pathname).toBe("/");
    expect(banner()).toBeNull();
  });

  it.each([
    ["the network fails", networkFailure],
    ["the limit is reached", problemAnswer(429)],
    ["the server fails", problemAnswer(503)],
    ["the answer is not a tracking view", () => Promise.resolve(jsonResponse({ nope: 1 }))],
  ])("shows the catalogue as it is, with no message, when %s", async (_reason, answer) => {
    openApplication({ tracking: answer });

    await catalogueShown();

    expect(window.location.pathname).toBe("/");
    expect(banner()).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(readConfirmedOrders(Date.now())).toHaveLength(1);
  });

  it("does not ask again within the same visit, whatever is rendered", async () => {
    const app = openApplication({
      hasCart: true,
      tracking: inSequence(viewAnswer(), networkFailure),
    });

    await screen.findByText(activeOrder.text);

    expect(app.trackingCalls()).toHaveLength(1);
  });
});

describe("waiting for the check", () => {
  it("keeps the loading state, then shows the catalogue and gives up the redirect after the limit", async () => {
    const { answer, settle } = pendingAnswer();
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    openApplication({ tracking: answer });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(LAUNCH_CHECK_TIMEOUT_MS - 1);
    });
    expect(document.querySelector('main [aria-busy="true"]')).not.toBeNull();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(screen.getByText(PRODUCT.name)).toBeTruthy();
    await act(async () => {
      settle();
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(window.location.pathname).toBe("/");
  });

  it("does not redirect a customer who went elsewhere while the answer was on its way", async () => {
    const { answer, settle } = pendingAnswer();
    openApplication({ tracking: answer });
    fireEvent.click(await screen.findByRole("link", { name: texts.cart.badgeLabel(0) }));
    await screen.findByRole("heading", { level: 1, name: texts.cart.screen.heading });

    await act(async () => {
      settle();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(window.location.pathname).toBe("/panier");
    });
  });
});

describe("the way to find an order", () => {
  it("is an icon beside the cart in the header, named in words, and not on the cart screen", async () => {
    openApplication({ isHandled: true, tracking: problemAnswer(404) });

    const link = await screen.findByRole("link", { name: texts.findOrder.entry });

    expect(link.getAttribute("href")).toBe("/retrouver");
    expect(link.getAttribute("title")).toBe(texts.findOrder.entry);
    expect(link.textContent).toBe("");
    const header = within(screen.getByRole("banner"));
    const cart = header.getByRole("link", { name: texts.cart.badgeLabel(0) });
    expect(header.getByRole("link", { name: texts.findOrder.entry })).toBe(link);
    expect(link.compareDocumentPosition(cart) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(
      within(screen.getByRole("main")).queryByRole("link", { name: texts.findOrder.entry }),
    ).toBeNull();
    fireEvent.click(cart);
    await screen.findByRole("heading", { level: 1, name: texts.cart.screen.heading });
    expect(screen.queryByRole("link", { name: texts.findOrder.entry })).toBeNull();
  });

  it("has no accessibility violation, with the icon alone or with the banner", async () => {
    openApplication({ isHandled: true, tracking: problemAnswer(404) });
    await catalogueShown();
    await expectNoAccessibilityViolations(document.body);
    cleanup();

    openApplication({ isHandled: true });
    await screen.findByText(activeOrder.text);
    await expectNoAccessibilityViolations(document.body);
  });
});
