import { formatAmount } from "@entana/contracts";
import { cleanup, fireEvent, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { texts } from "../../i18n/texts";
import {
  KOBA,
  MOFO,
  SAKAFO,
  openContact,
  summaryCard,
} from "../../test-support/harnesses/contact-harness";
import { CART_STORAGE_KEY } from "../cart/storage/cart-storage";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("the order summary beside the form", () => {
  it("adds the lines up, delivery free, and shows the exact total", async () => {
    openContact({
      lines: [
        [SAKAFO.id, 2],
        [MOFO.id, 1],
      ],
    });

    const card = within(await summaryCard());
    await card.findByText(SAKAFO.name);
    expect(card.getAllByRole("listitem")).toHaveLength(2);
    // The amounts hold no-break spaces: the text content is compared, not a text matcher.
    const content = (await summaryCard()).textContent;
    expect(content).toContain(formatAmount(9000));
    expect(content).toContain(formatAmount(3000));
    expect(content).toContain(formatAmount(12000));
    expect(content).toContain(texts.delivery.fee.free);
    expect(content).toContain(texts.orderSummary.quantity(2));
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

  it("leaves out a product that is no longer available, and says so", async () => {
    openContact({
      lines: [
        [SAKAFO.id, 1],
        [KOBA.id, 2],
      ],
    });

    expect(await screen.findByText(texts.cart.removedUnavailable)).toBeTruthy();
    const card = await summaryCard();
    expect(card.textContent).toContain(formatAmount(4500));
    expect(card.textContent).not.toContain(KOBA.name);
    expect(localStorage.getItem(CART_STORAGE_KEY)).not.toContain(KOBA.id);
  });
});
