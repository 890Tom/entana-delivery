import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { texts } from "../../i18n/texts";
import { buildDrafts } from "../../test-support/build-order-submission";
import { NOTE, SAKAFO } from "../../test-support/contact-harness";
import { expectNoAccessibilityViolations } from "../../test-support/expect-no-accessibility-violations";
import { buildCleanup } from "../../test-support/order-submission-answers";
import { resetOrderSubmission } from "../../test-support/reset-order-submission";
import {
  contactDraft,
  createdAnswer,
  headerOf,
  openReview,
  orderCalls,
  problemAnswer,
  readySendButtons,
} from "../../test-support/review-harness";
import { jsonResponse } from "../../test-support/stub-fetch";
import { getOrderSubmissionState, submitOrder } from "../order-submission/order-submission";

/** The first answer, then the second one for every request after it. */
function inSequence(
  first: () => Promise<Response>,
  then: () => Promise<Response>,
): () => Promise<Response> {
  let count = 0;
  return () => {
    count += 1;
    return count === 1 ? first() : then();
  };
}

/** Opens the review, clicks "Envoyer la commande" and waits for the failure notice. */
async function failFirstSend(
  order: () => Promise<Response>,
  options: Parameters<typeof openReview>[0] = {},
): Promise<{ alert: HTMLElement; fetchStub: ReturnType<typeof openReview>["fetchStub"] }> {
  const { fetchStub } = openReview({ ...options, order });
  const { card } = await readySendButtons();
  fireEvent.click(card);
  return { alert: await screen.findByRole("alert"), fetchStub };
}

beforeEach(() => {
  resetOrderSubmission();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("a failed send", () => {
  it("shows the notice, gives it the focus and replays the identical request on retry", async () => {
    const { alert, fetchStub } = await failFirstSend(inSequence(problemAnswer(503), createdAnswer));
    expect(alert.textContent).toContain("Le service est momentanément indisponible. Réessayez.");
    expect(alert.textContent).not.toContain("SECRET");
    expect(document.activeElement).toBe(alert);

    fireEvent.click(within(alert).getByRole("button", { name: texts.common.retry }));

    await waitFor(() => {
      expect(orderCalls(fetchStub)).toHaveLength(2);
    });
    const [first, second] = orderCalls(fetchStub);
    expect(headerOf(first, "Idempotency-Key")).toBeTruthy();
    expect(headerOf(second, "Idempotency-Key")).toBe(headerOf(first, "Idempotency-Key"));
    expect(second?.[1]?.body).toBe(first?.[1]?.body);
  });

  it("sends a new order, with a new key, on retry of an error that is not replayable", async () => {
    const { alert, fetchStub } = await failFirstSend(problemAnswer(418));
    expect(alert.textContent).toContain("Une erreur est survenue. Réessayez.");

    fireEvent.click(within(alert).getByRole("button", { name: texts.common.retry }));

    await waitFor(() => {
      expect(orderCalls(fetchStub)).toHaveLength(2);
    });
    const [first, second] = orderCalls(fetchStub);
    expect(headerOf(second, "Idempotency-Key")).not.toBe(headerOf(first, "Idempotency-Key"));
  });

  it("names the unavailable products from the catalogue and leads to the cart", async () => {
    const body = { type: "about:blank", title: "SECRET", status: 422, productIds: [SAKAFO.id] };

    const { alert } = await failFirstSend(() => Promise.resolve(jsonResponse(body, 422)));

    expect(alert.textContent).toContain(
      `Certains produits ne sont plus disponibles : ${SAKAFO.name}.`,
    );
    const link = within(alert).getByRole("link", { name: "Voir le panier" });
    expect(link.getAttribute("href")).toBe("/panier");
  });

  it("leads a refused field to the screen where it is edited", async () => {
    const body = {
      type: "about:blank",
      title: "x",
      status: 400,
      errors: [{ pointer: "/phone", detail: "x" }],
    };
    const { alert } = await failFirstSend(() => Promise.resolve(jsonResponse(body, 400)));

    fireEvent.click(within(alert).getByRole("link", { name: "Modifier" }));

    await screen.findByRole("heading", { level: 1, name: texts.contact.heading });
    expect(window.location.pathname).toBe("/coordonnees");
  });

  it("shows no old failure when the customer leaves the screen and comes back", async () => {
    await failFirstSend(problemAnswer(503));

    fireEvent.click(screen.getByRole("link", { name: texts.shell.backToContact }));
    await screen.findByRole("heading", { level: 1, name: texts.contact.heading });
    const [continueButton] = await screen.findAllByRole("button", {
      name: texts.contact.continue,
    });
    if (continueButton !== undefined) {
      fireEvent.click(continueButton);
    }

    await screen.findByText("Date de livraison confirmée par notre équipe.");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("has no accessibility violation with the error shown", async () => {
    await failFirstSend(problemAnswer(503));

    await expectNoAccessibilityViolations(document.body);
  });
});

describe("the end of a confirmed order", () => {
  it("keeps the confirmation for the tracking screen: the review does not dismiss it", async () => {
    openReview({ order: createdAnswer });
    const { card } = await readySendButtons();

    fireEvent.click(card);

    await waitFor(() => {
      expect(window.location.pathname).toBe("/suivi");
    });
    // The tracking screen dismisses the confirmation as it opens: that it still showed the thanks
    // is the proof that the review had not dismissed it before.
    expect(await screen.findByText(texts.tracking.thanks)).toBeTruthy();
  });

  it("goes to the tracking address when the order is confirmed and the cart is empty", async () => {
    vi.stubGlobal("fetch", vi.fn(createdAnswer));
    await submitOrder(buildDrafts(), buildCleanup());

    openReview({ lines: [] });

    await waitFor(() => {
      expect(window.location.pathname).toBe("/suivi");
    });
    // The tracking screen dismisses the confirmation as it opens: that it still showed the thanks
    // is the proof that the review had not dismissed it before.
    expect(await screen.findByText(texts.tracking.thanks)).toBeTruthy();
  });

  it("forgets the old confirmation when a new order has begun, then applies the guards", async () => {
    vi.stubGlobal("fetch", vi.fn(createdAnswer));
    await submitOrder(buildDrafts(), buildCleanup());

    openReview();

    await screen.findByText("Portail bleu");
    expect(window.location.pathname).toBe("/recapitulatif");
    expect(getOrderSubmissionState().status).toBe("idle");
  });
});

describe("what leaves the page", () => {
  it("holds no personal data, token or code in the console, the addresses or the page", async () => {
    const consoleCalls = (["log", "info", "warn", "error", "debug"] as const).map((method) =>
      vi.spyOn(console, method).mockImplementation(() => undefined),
    );
    const { alert, fetchStub } = await failFirstSend(
      inSequence(problemAnswer(503), createdAnswer),
      { contactDraft: contactDraft(NOTE) },
    );
    fireEvent.click(within(alert).getByRole("button", { name: texts.common.retry }));
    await waitFor(() => {
      expect(window.location.pathname).toBe("/suivi");
    });

    const sentBody = orderCalls(fetchStub)[0]?.[1]?.body;
    const token = /"trackingToken":"([^"]+)"/.exec(
      typeof sentBody === "string" ? sentBody : "",
    )?.[1];
    expect(token).toHaveLength(43);
    const outside = JSON.stringify([
      consoleCalls.map((spy) => spy.mock.calls),
      window.location.href,
      fetchStub.mock.calls.map((call: readonly unknown[]) => call[0]),
      document.body.textContent,
    ]);
    expect(outside).not.toContain(token ?? "");
    expect(outside).not.toMatch(/K7M2QX|Rakoto|Portail|Avant 15h|341234567|18\.91|47\.51/);
  });
});
