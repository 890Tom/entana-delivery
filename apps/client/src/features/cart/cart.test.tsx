import { MAX_ORDER_LINE_QUANTITY } from "@entana/contracts";
import { QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "../../app";
import { createQueryClient } from "../../data-fetching/query-client";
import { texts } from "../../i18n/texts";
import { buildProduct, buildProductId } from "../../test-support/build-product";
import { expectNoAccessibilityViolations } from "../../test-support/expect-no-accessibility-violations";
import { jsonResponse } from "../../test-support/stub-fetch";

import { CART_STORAGE_KEY } from "./storage/cart-storage";

const SAKAFO = buildProduct({ id: buildProductId(1), name: "Sakafo" });
const MOFO = buildProduct({ id: buildProductId(2), name: "Mofo" });
const SOLD_OUT = buildProduct({ id: buildProductId(3), name: "Koba", available: false });

function stubApi(products: readonly unknown[]): void {
  vi.stubGlobal(
    "fetch",
    vi.fn((input: RequestInfo | URL) =>
      Promise.resolve(
        input === "/api/v1/instance"
          ? new Response("{}", { status: 500 })
          : jsonResponse({ products }),
      ),
    ),
  );
}

function seedCart(...lines: [string, number][]): void {
  localStorage.setItem(
    CART_STORAGE_KEY,
    JSON.stringify({
      version: 1,
      lines: lines.map(([productId, quantity]) => ({ productId, quantity })),
    }),
  );
}

async function renderCatalogue(): Promise<void> {
  window.history.pushState({}, "", "/");
  render(
    <QueryClientProvider client={createQueryClient()}>
      <App />
    </QueryClientProvider>,
  );
  await screen.findByRole("heading", { name: "Sakafo" });
}

// The side cart repeats the lines of the cart: the card controls are looked up in the main area.
function catalogueArea(): HTMLElement {
  return screen.getByRole("main");
}

function addButton(name: string): HTMLElement {
  return within(catalogueArea()).getByRole("button", { name: `Ajouter ${name} au panier` });
}

function plusButton(name: string): HTMLElement {
  return within(catalogueArea()).getByRole("button", { name: `Ajouter une unité de ${name}` });
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("the product card cart control", () => {
  it("offers Add, then the quantity selector, and the header badge follows", async () => {
    stubApi([SAKAFO, MOFO]);
    await renderCatalogue();
    expect(screen.getByRole("link", { name: "Voir le panier" })).toBeTruthy();

    fireEvent.click(addButton("Sakafo"));
    fireEvent.click(plusButton("Sakafo"));
    fireEvent.click(addButton("Mofo"));

    const group = within(catalogueArea()).getByRole("group", { name: "Quantité — Sakafo" });
    expect(group.textContent).toContain("2");
    expect(screen.getByRole("link", { name: "Voir le panier, 3 articles" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Ajouter Sakafo au panier" })).toBeNull();
  });

  it("moves the focus to the plus button after Add", async () => {
    stubApi([SAKAFO]);
    await renderCatalogue();

    fireEvent.click(addButton("Sakafo"));

    expect(document.activeElement).toBe(plusButton("Sakafo"));
  });

  it("removes the line with the last unit and gives the focus back to the Add button", async () => {
    stubApi([SAKAFO]);
    await renderCatalogue();
    fireEvent.click(addButton("Sakafo"));

    fireEvent.click(
      within(catalogueArea()).getByRole("button", { name: "Retirer Sakafo du panier" }),
    );

    expect(document.activeElement).toBe(addButton("Sakafo"));
    expect(screen.getByRole("link", { name: "Voir le panier" })).toBeTruthy();
  });

  it("names the minus button for one unit when more than one is in the cart", async () => {
    stubApi([SAKAFO]);
    seedCart([SAKAFO.id, 2]);
    await renderCatalogue();

    fireEvent.click(
      within(catalogueArea()).getByRole("button", { name: "Retirer une unité de Sakafo" }),
    );

    expect(
      within(catalogueArea()).getByRole("group", { name: "Quantité — Sakafo" }).textContent,
    ).toContain("1");
  });

  it("announces the quantity politely and disables plus at the maximum", async () => {
    stubApi([SAKAFO]);
    seedCart([SAKAFO.id, MAX_ORDER_LINE_QUANTITY]);
    await renderCatalogue();

    const group = within(catalogueArea()).getByRole("group", { name: "Quantité — Sakafo" });
    expect(within(group).getByText(String(MAX_ORDER_LINE_QUANTITY)).getAttribute("aria-live")).toBe(
      "polite",
    );
    expect(plusButton("Sakafo").getAttribute("aria-disabled")).toBe("true");
  });

  it("keeps the focus on plus when it reaches the maximum, and then does nothing", async () => {
    stubApi([SAKAFO]);
    seedCart([SAKAFO.id, MAX_ORDER_LINE_QUANTITY - 1]);
    await renderCatalogue();
    const plus = plusButton("Sakafo");
    plus.focus();

    fireEvent.click(plus);
    fireEvent.click(plus);

    expect(document.activeElement).toBe(plus);
    expect(plus.getAttribute("aria-disabled")).toBe("true");
    expect(
      screen.getByRole("link", {
        name: `Voir le panier, ${String(MAX_ORDER_LINE_QUANTITY)} articles`,
      }),
    ).toBeTruthy();
  });

  it("has no add control on an unavailable product, only a disabled button", async () => {
    stubApi([SAKAFO, SOLD_OUT]);
    await renderCatalogue();

    const button = screen.getByRole("button", { name: texts.catalogue.product.unavailable });
    expect(button.getAttribute("aria-disabled")).toBe("true");
    expect(screen.queryByRole("button", { name: /Koba/ })).toBeNull();
    expect(screen.getAllByRole("button")).toHaveLength(2);
  });

  it("has no accessibility violation with products in the cart", async () => {
    stubApi([SAKAFO, MOFO, SOLD_OUT]);
    seedCart([SAKAFO.id, 3]);
    await renderCatalogue();

    await expectNoAccessibilityViolations(document.body);
  });
});

describe("the cart and the loaded catalogue", () => {
  it("removes absent and unavailable products, tells it once, and saves the result", async () => {
    stubApi([SAKAFO, SOLD_OUT]);
    seedCart([SAKAFO.id, 2], [SOLD_OUT.id, 1], [MOFO.id, 4]);

    await renderCatalogue();

    await waitFor(() => {
      expect(screen.getAllByText(texts.cart.removedUnavailable)).toHaveLength(1);
    });
    expect(screen.getByRole("link", { name: "Voir le panier, 2 articles" })).toBeTruthy();
    expect(JSON.parse(localStorage.getItem(CART_STORAGE_KEY) ?? "null")).toEqual({
      version: 1,
      lines: [{ productId: SAKAFO.id, quantity: 2 }],
    });
  });

  it("does not tell anything when nothing had to be removed", async () => {
    stubApi([SAKAFO]);
    seedCart([SAKAFO.id, 2]);

    await renderCatalogue();

    expect(screen.queryByText(texts.cart.removedUnavailable)).toBeNull();
  });

  it("does not empty the cart when the catalogue is empty", async () => {
    stubApi([]);
    seedCart([SAKAFO.id, 2]);
    window.history.pushState({}, "", "/");
    render(
      <QueryClientProvider client={createQueryClient()}>
        <App />
      </QueryClientProvider>,
    );

    await screen.findByText(texts.catalogue.empty);

    expect(screen.getByRole("link", { name: "Voir le panier, 2 articles" })).toBeTruthy();
    expect(screen.queryByText(texts.cart.removedUnavailable)).toBeNull();
  });

  it("works in memory when the storage is unavailable", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("denied", "SecurityError");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("full", "QuotaExceededError");
    });
    stubApi([SAKAFO]);
    await renderCatalogue();

    fireEvent.click(addButton("Sakafo"));

    expect(screen.getByRole("link", { name: "Voir le panier, 1 article" })).toBeTruthy();
  });
});
