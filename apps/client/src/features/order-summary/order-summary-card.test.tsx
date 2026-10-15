import { formatAmount } from "@entana/contracts";
import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { texts } from "../../i18n/texts";
import {
  KOBA,
  MOFO,
  SAKAFO,
  openContact,
  summaryCard,
} from "../../test-support/harnesses/contact-harness";
import { buildOutOfAxisQuote } from "../../test-support/builders/build-delivery-quote";
import { CART_STORAGE_KEY } from "../cart/storage/cart-storage";
import { DELIVERY_DRAFT_STORAGE_KEY } from "../delivery/delivery-draft/delivery-draft-storage";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("the order summary beside the form", () => {
  it("shows the fee of the retained quote, and a total of the subtotal plus the fee", async () => {
    openContact({
      lines: [
        [SAKAFO.id, 2],
        [MOFO.id, 1],
      ],
      quote: buildOutOfAxisQuote({ feeAr: 3000 }),
    });

    const card = within(await summaryCard());
    await card.findByText(SAKAFO.name);
    expect(card.getAllByRole("listitem")).toHaveLength(2);
    // The amounts hold no-break spaces: the text content is compared, not a text matcher.
    const content = (await summaryCard()).textContent;
    expect(content).toContain(formatAmount(9000));
    expect(content).toContain("Hors zone démo");
    expect(content).toContain(formatAmount(3000));
    // 2 x 4 500 + 1 x 3 000, plus the fee.
    expect(content).toContain(formatAmount(15000));
    expect(content).toContain(texts.orderSummary.quantity(2));
  });

  it("asks nothing of the server for the fee: the quote of the delivery screen is used", async () => {
    const { fetchStub } = openContact();

    await within(await summaryCard()).findByText(SAKAFO.name);

    expect(fetchStub.mock.calls.map((call: unknown[]) => call[0])).not.toContain(
      "/api/v1/delivery/quote",
    );
  });

  it("shows a skeleton while the catalogue loads, and no amount", async () => {
    openContact({ api: { catalogue: "pending" } });

    const card = await summaryCard();
    expect(card.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(card.textContent).not.toContain(" Ar");
  });

  it("shows an error with a retry when the catalogue fails, then the amounts", async () => {
    const { control } = openContact({ api: { catalogue: "server-error" } });
    const card = within(await summaryCard());
    const retry = await card.findByRole("button", { name: texts.common.retry });

    control.catalogue = "ok";
    fireEvent.click(retry);

    expect(await card.findByText(SAKAFO.name)).toBeTruthy();
  });

  it("sends back to the delivery screen, drafts kept and the notice shown, when a product dropped changes the pieces", async () => {
    openContact({
      lines: [
        [SAKAFO.id, 1],
        [KOBA.id, 2],
      ],
    });

    await waitFor(() => {
      expect(window.location.pathname).toBe("/livraison");
    });
    expect(await screen.findByText(texts.cart.removedUnavailable)).toBeTruthy();
    expect(localStorage.getItem(CART_STORAGE_KEY)).not.toContain(KOBA.id);
    expect(sessionStorage.getItem(DELIVERY_DRAFT_STORAGE_KEY)).toContain("Portail bleu");
  });
});
