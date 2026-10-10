import { formatAmount } from "@entana/contracts";
import { QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "../../../app";
import { createQueryClient } from "../../../data-fetching/query-client";
import { buildInstance } from "../../../test-support/build-instance";
import { buildProduct, buildProductId } from "../../../test-support/build-product";
import { expectNoAccessibilityViolations } from "../../../test-support/expect-no-accessibility-violations";
import { jsonResponse, problemResponse } from "../../../test-support/stub-fetch";
import { CART_STORAGE_KEY } from "../../cart/storage/cart-storage";

const SAKAFO = buildProduct({ id: buildProductId(1), name: "Sakafo", priceAr: 4500 });
const MOFO = buildProduct({ id: buildProductId(2), name: "Mofo", priceAr: 3000 });

// Compared with every kind of space read as one: formatAmount uses non-breaking spaces.
const viewCartWith =
  (amountAr: number) =>
  (name: string): boolean =>
    name.replace(/\s/g, " ") === `Voir le panier · ${formatAmount(amountAr).replace(/\s/g, " ")}`;
// 2 x 4 500 + 1 x 3 000, then one more Sakafo.
const SAMPLE_TOTAL = 12000;
const NEXT_TOTAL = 16500;

// The header's own cart link is named almost the same: the bar is the one inside the main area.
const getMainLink = (name: string | RegExp): HTMLElement =>
  within(screen.getByRole("main")).getByRole("link", { name });
const queryMainLink = (name: string | RegExp): HTMLElement | null =>
  within(screen.getByRole("main")).queryByRole("link", { name });

function stubApi(products: () => Promise<Response>): void {
  vi.stubGlobal(
    "fetch",
    vi.fn((input: RequestInfo | URL) =>
      input === "/api/v1/instance" ? Promise.resolve(jsonResponse(buildInstance())) : products(),
    ),
  );
}

const catalogueOf = (): Promise<Response> =>
  Promise.resolve(jsonResponse({ products: [SAKAFO, MOFO] }));

function seedSampleCart(): void {
  localStorage.setItem(
    CART_STORAGE_KEY,
    JSON.stringify({
      version: 1,
      lines: [
        { productId: SAKAFO.id, quantity: 2 },
        { productId: MOFO.id, quantity: 1 },
      ],
    }),
  );
}

function renderAt(path: string): ReturnType<typeof render> {
  window.history.pushState({}, "", path);
  return render(
    <QueryClientProvider client={createQueryClient()}>
      <App />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("the bottom bar of the catalogue", () => {
  it("links to the cart with the exact total of the cart", async () => {
    stubApi(catalogueOf);
    seedSampleCart();
    renderAt("/");

    const link = await screen.findByRole("link", { name: viewCartWith(SAMPLE_TOTAL) });

    expect(link.getAttribute("href")).toBe("/panier");
  });

  it("is not there when the cart is empty", async () => {
    stubApi(catalogueOf);
    renderAt("/");
    await screen.findByText("Sakafo");

    expect(queryMainLink(/^Voir le panier/)).toBeNull();
  });

  it("shows a placeholder for the total while the catalogue loads, and the link works", () => {
    stubApi(() => new Promise<Response>(() => undefined));
    seedSampleCart();
    renderAt("/");

    const link = getMainLink("Voir le panier");

    expect(link.getAttribute("href")).toBe("/panier");
    expect(link.getAttribute("aria-disabled")).toBeNull();
    expect(link.querySelector('[aria-hidden="true"]')).not.toBeNull();
  });

  it("shows no total when the catalogue fails, and the link still works", async () => {
    stubApi(() => Promise.resolve(problemResponse(500)));
    seedSampleCart();
    renderAt("/");
    await within(screen.getByRole("main")).findByRole("alert");

    const link = getMainLink("Voir le panier");

    expect(link.getAttribute("href")).toBe("/panier");
    expect(link.querySelector('[aria-hidden="true"]')).toBeNull();
    expect(link.textContent).not.toMatch(/\d/);
  });

  it("follows a change of quantity", async () => {
    stubApi(catalogueOf);
    seedSampleCart();
    renderAt("/");
    await screen.findByRole("link", { name: viewCartWith(SAMPLE_TOTAL) });

    fireEvent.click(
      within(screen.getByRole("main")).getByRole("button", { name: "Ajouter une unité de Sakafo" }),
    );

    await waitFor(() => {
      expect(screen.getByRole("link", { name: viewCartWith(NEXT_TOTAL) })).toBeTruthy();
    });
  });

  it("has no accessibility violation", async () => {
    stubApi(catalogueOf);
    seedSampleCart();
    const { container } = renderAt("/");
    await screen.findByRole("link", { name: viewCartWith(SAMPLE_TOTAL) });

    await expectNoAccessibilityViolations(container);
  });
});

describe("the bottom bar of the cart screen", () => {
  it("links to the delivery route when the cart holds an article: the bar, and the link that replaces it from 1024 px", async () => {
    stubApi(catalogueOf);
    seedSampleCart();
    renderAt("/panier");

    const links = await screen.findAllByRole("link", { name: "Choisir où livrer" });

    expect(links.map((link) => link.getAttribute("href"))).toEqual(["/livraison", "/livraison"]);
  });

  it("is not there when the cart is empty", async () => {
    stubApi(catalogueOf);
    renderAt("/panier");
    await screen.findByText("Votre panier est vide.");

    expect(screen.queryByRole("link", { name: "Choisir où livrer" })).toBeNull();
  });
});
