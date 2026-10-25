import { TRACKING_TOKEN_HEADER } from "@entana/contracts";
import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { texts } from "../../../i18n/texts";
import { expectNoAccessibilityViolations } from "../../../test-support/assertions/expect-no-accessibility-violations";
import { codeInput, openFindOrder } from "../../../test-support/harnesses/find-order-harness";
import {
  sentHeaders,
  storedOrders,
  viewAnswer,
} from "../../../test-support/harnesses/tracking-harness";
import { resetOrderSubmission } from "../../../test-support/order-submission/reset-order-submission";

const { deviceOrders } = texts.findOrder;
const NOW = Date.parse("2026-10-10T12:00:00.000Z");
const DAY = 24 * 60 * 60 * 1000;

/** An order confirmed on the device a number of days before now, at 08:30 UTC. */
const confirmed = (code: string, daysAgo = 0, token = "A".repeat(43)) => ({
  code,
  token,
  createdAt: new Date(NOW - daysAgo * DAY - 3.5 * 60 * 60 * 1000).toISOString(),
});

const listButtons = async (): Promise<HTMLElement[]> => {
  const list = await screen.findByRole("list", { name: deviceOrders.title });
  return within(list).getAllByRole("button");
};
const codesOf = (buttons: readonly HTMLElement[]): (string | undefined)[] =>
  buttons.map((button) => /[A-Z0-9]{6}/.exec(button.textContent)?.[0]);

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  resetOrderSubmission();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  window.history.replaceState({}, "", "/");
});

describe("the orders of the device", () => {
  it("lists a new order beside the ones already confirmed, with its code and its day", async () => {
    openFindOrder({
      lookup: viewAnswer(),
      confirmed: [confirmed("AAAAAA", 2, "B".repeat(43)), confirmed("K7M2QX")],
    });

    const buttons = await listButtons();

    expect(buttons.map((button) => button.textContent)).toEqual([
      deviceOrders.order("K7M2QX", "samedi 10 octobre"),
      deviceOrders.order("AAAAAA", "jeudi 8 octobre"),
    ]);
  });

  it("shows the ten most recent, the newest first", async () => {
    const letters = ["A", "B", "C", "D", "E", "F", "G", "H", "J", "K", "L"];
    // Confirmed in a shuffled order: the list follows the day of the order, not the storage.
    const orders = letters.map((letter, index) =>
      confirmed(`AAAAA${letter}`, index, letter.repeat(43)),
    );
    openFindOrder({ lookup: viewAnswer(), confirmed: [...orders.slice(5), ...orders.slice(0, 5)] });

    const buttons = await listButtons();

    expect(codesOf(buttons)).toEqual(letters.slice(0, 10).map((letter) => `AAAAA${letter}`));
  });

  it("shows no list when the device remembers no order", async () => {
    openFindOrder({ lookup: viewAnswer() });

    await codeInput();

    expect(screen.queryByRole("heading", { name: deviceOrders.title })).toBeNull();
  });

  it("opens the tracking of the order chosen in the list", async () => {
    const app = openFindOrder({
      lookup: viewAnswer(),
      confirmed: [confirmed("AAAAAA", 2, "B".repeat(43)), confirmed("K7M2QX")],
      tracking: viewAnswer({ orderCode: "AAAAAA" }),
    });
    await listButtons();

    fireEvent.click(
      screen.getByRole("button", { name: deviceOrders.order("AAAAAA", "jeudi 8 octobre") }),
    );

    await waitFor(() => {
      expect(app.trackingCalls()).toHaveLength(1);
    });
    expect(sentHeaders(app.trackingCalls()[0]).get(TRACKING_TOKEN_HEADER)).toBe("B".repeat(43));
    expect(window.location.pathname + window.location.hash).toBe("/suivi");
  });

  it("keeps nothing personal on the device after an order is opened from the list", async () => {
    openFindOrder({
      lookup: viewAnswer(),
      confirmed: [confirmed("K7M2QX")],
      tracking: viewAnswer({ landmarkText: "Portail bleu" }),
    });
    await listButtons();

    fireEvent.click(
      screen.getByRole("button", { name: deviceOrders.order("K7M2QX", "samedi 10 octobre") }),
    );

    await screen.findByText("Portail bleu");
    await waitFor(() => {
      expect(storedOrders().map((entry) => Object.keys(entry).sort())).toEqual([
        ["code", "createdAt", "token"],
      ]);
    });
  });

  it("has no accessibility violation with the list", async () => {
    openFindOrder({ lookup: viewAnswer(), confirmed: [confirmed("K7M2QX")] });
    await listButtons();

    await expectNoAccessibilityViolations(document.body);
  });
});
