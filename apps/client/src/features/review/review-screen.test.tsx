import { formatAmount } from "@entana/contracts";
import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { texts } from "../../i18n/texts";
import { MOFO, NAME, NOTE, SAKAFO } from "../../test-support/harnesses/contact-harness";
import { resetOrderSubmission } from "../../test-support/order-submission/reset-order-submission";
import {
  amountsCard,
  contactDraft,
  createdAnswer,
  openReview,
  orderCalls,
  readySendButtons,
  sendButtons,
} from "../../test-support/harnesses/review-harness";

/** A text matcher that ignores which kind of space (the no-break one of amounts) is used. */
const hasText =
  (text: string) =>
  (_content: string, element: Element | null): boolean =>
    element?.children.length === 0 &&
    element.textContent.replace(/\s/g, " ") === text.replace(/\s/g, " ");

const settle = async (): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, 20));
};

beforeEach(() => {
  resetOrderSubmission();
  document.title = "";
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("the review guards", () => {
  it("sends an empty cart back to the cart, replacing the history entry", async () => {
    const lengthBefore = window.history.length;

    openReview({ lines: [] });

    await screen.findByRole("heading", { level: 1, name: texts.cart.screen.heading });
    expect(window.location.pathname).toBe("/panier");
    expect(window.history.length).toBe(lengthBefore + 1);
  });

  it("sends an incomplete delivery back to the delivery screen", async () => {
    openReview({ delivery: { version: 1, point: null, landmark: "Portail bleu" } });

    await screen.findByRole("heading", { level: 1, name: texts.delivery.heading });
    expect(window.location.pathname).toBe("/livraison");
  });

  it.each([
    ["no contact draft", ""],
    ["a phone number that is not valid", contactDraft().replace("34 12 345 67", "12")],
  ])("sends %s back to the contact screen", async (_label, draft) => {
    openReview({ contactDraft: draft });

    await screen.findByRole("heading", { level: 1, name: texts.contact.heading });
    expect(window.location.pathname).toBe("/coordonnees");
  });
});

describe("the review content", () => {
  it("shows the lines at the catalogue's prices, a free delivery and the total", async () => {
    openReview({
      lines: [
        [SAKAFO.id, 2],
        [MOFO.id, 1],
      ],
    });

    await screen.findByText(hasText(formatAmount(2 * SAKAFO.priceAr)));
    const card = within(amountsCard());
    expect(card.getByText(SAKAFO.name, { exact: false })).toBeTruthy();
    expect(card.getByText(texts.orderSummary.quantity(2))).toBeTruthy();
    expect(card.getByText(hasText(formatAmount(MOFO.priceAr)))).toBeTruthy();
    expect(card.getByText(texts.delivery.fee.free)).toBeTruthy();
    expect(card.getByText(hasText(formatAmount(2 * SAKAFO.priceAr + MOFO.priceAr)))).toBeTruthy();
  });

  it("shows the landmark, the name and the formatted number, the date and the payment", async () => {
    openReview();

    await screen.findByText("Portail bleu");
    expect(await screen.findByText(`${NAME} · +261 34 12 345 67`)).toBeTruthy();
    expect(screen.queryByText(/^Note : /)).toBeNull();
    expect(screen.getByText("Date de livraison confirmée par notre équipe.")).toBeTruthy();
    expect(screen.getByText("Paiement à la livraison, au livreur.")).toBeTruthy();
  });

  it("shows the note when there is one", async () => {
    openReview({ contactDraft: contactDraft(NOTE) });

    await screen.findByText(`Note : ${NOTE}`);
  });

  it("leads each Modifier to its screen", async () => {
    openReview();

    const address = await screen.findByRole("link", { name: "Modifier l'adresse" });
    const contact = screen.getByRole("link", { name: "Modifier les coordonnées" });

    expect(address.getAttribute("href")).toBe("/livraison");
    expect(contact.getAttribute("href")).toBe("/coordonnees");
    expect(address.textContent).toBe("Modifier");
  });

  it("puts the send buttons after both Modifier links in the document", async () => {
    openReview();
    const { bar, card } = await waitFor(sendButtons);
    const links = [
      screen.getByRole("link", { name: "Modifier l'adresse" }),
      screen.getByRole("link", { name: "Modifier les coordonnées" }),
    ];

    for (const link of links) {
      for (const button of [bar, card]) {
        expect(
          link.compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING,
        ).toBeTruthy();
      }
    }
  });
});

describe("sending the order", () => {
  it("sends one request, then leaves for the tracking address without going through the cart", async () => {
    const { fetchStub } = openReview({ order: createdAnswer });
    const { card } = await readySendButtons();
    const lengthBefore = window.history.length;
    const visited: string[] = [];
    for (const method of ["pushState", "replaceState"] as const) {
      const original = window.history[method].bind(window.history);
      vi.spyOn(window.history, method).mockImplementation((state, unused, url) => {
        visited.push(String(url));
        original(state, unused, url);
      });
    }

    fireEvent.click(card);

    await waitFor(() => {
      expect(window.location.pathname).toBe("/suivi");
    });
    expect(orderCalls(fetchStub)).toHaveLength(1);
    expect(window.history.length).toBe(lengthBefore);
    expect(visited).not.toContain("/panier");
  });

  it("sends once whatever the number of clicks", async () => {
    const { fetchStub } = openReview();
    const { bar } = await readySendButtons();

    fireEvent.click(bar);
    fireEvent.click(bar);
    fireEvent.click(bar);

    await settle();
    expect(orderCalls(fetchStub)).toHaveLength(1);
  });

  it("marks both buttons busy and announces the sending, with the same label", async () => {
    openReview();
    const { bar, card } = await readySendButtons();

    fireEvent.click(card);

    await waitFor(() => {
      expect(card.getAttribute("aria-disabled")).toBe("true");
    });
    for (const button of [bar, card]) {
      expect(button.getAttribute("aria-busy")).toBe("true");
      expect(button.getAttribute("disabled")).toBeNull();
      expect(button.textContent).toBe(texts.review.send);
    }
    expect(screen.getByText("Envoi de la commande en cours.")).toBeTruthy();
  });

  it.each([
    ["the instance", { instance: "pending" }],
    ["the catalogue", { catalogue: "pending" }],
  ] as const)("does nothing while %s is not loaded", async (_label, api) => {
    const { fetchStub } = openReview({ api });
    const { bar, card } = await waitFor(sendButtons);

    fireEvent.click(card);
    fireEvent.click(bar);

    await settle();
    expect(bar.getAttribute("aria-disabled")).toBe("true");
    expect(card.getAttribute("aria-disabled")).toBe("true");
    expect(orderCalls(fetchStub)).toHaveLength(0);
  });

  it.each([
    ["the instance", { instance: "server-error" }],
    ["the catalogue", { catalogue: "server-error" }],
  ] as const)("shows a retry and keeps the button inactive when %s fails", async (_label, api) => {
    const { fetchStub } = openReview({ api });

    await screen.findByRole("button", { name: texts.common.retry });

    const { bar, card } = sendButtons();
    for (const button of [bar, card]) {
      fireEvent.click(button);
      expect(button.getAttribute("aria-disabled")).toBe("true");
    }
    expect(orderCalls(fetchStub)).toHaveLength(0);
  });
});
