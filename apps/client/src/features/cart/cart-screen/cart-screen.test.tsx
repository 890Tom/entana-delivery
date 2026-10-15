import { QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "../../../app";
import { createQueryClient } from "../../../data-fetching/query-client";
import { texts } from "../../../i18n/texts";
import { buildInstance } from "../../../test-support/builders/build-instance";
import { buildProduct, buildProductId } from "../../../test-support/builders/build-product";
import { expectNoAccessibilityViolations } from "../../../test-support/assertions/expect-no-accessibility-violations";
import { jsonResponse, problemResponse } from "../../../test-support/stubs/stub-fetch";
import { CART_STORAGE_KEY } from "../storage/cart-storage";

const SAKAFO = buildProduct({ id: buildProductId(1), name: "Sakafo", priceAr: 4500 });
const MOFO = buildProduct({ id: buildProductId(2), name: "Mofo", priceAr: 3000 });
const SOLD_OUT = buildProduct({ id: buildProductId(3), name: "Koba", available: false });

// The network boundary, answered by address. `products` is a function so that a test can change
// the answer between two calls.
function stubApi(products: () => Promise<Response>): ReturnType<typeof vi.fn> {
  const fetchStub = vi.fn((input: RequestInfo | URL) =>
    input === "/api/v1/instance" ? Promise.resolve(jsonResponse(buildInstance())) : products(),
  );
  vi.stubGlobal("fetch", fetchStub);
  return fetchStub;
}

const catalogueOf =
  (...products: readonly unknown[]) =>
  (): Promise<Response> =>
    Promise.resolve(jsonResponse({ products }));

function seedCart(...lines: [string, number][]): void {
  localStorage.setItem(
    CART_STORAGE_KEY,
    JSON.stringify({
      version: 1,
      lines: lines.map(([productId, quantity]) => ({ productId, quantity })),
    }),
  );
}

function renderAt(path: string): void {
  window.history.pushState({}, "", path);
  render(
    <QueryClientProvider client={createQueryClient()}>
      <App />
    </QueryClientProvider>,
  );
}

async function findLine(name: string): Promise<HTMLElement> {
  const heading = await screen.findByRole("heading", { level: 2, name });
  return heading.closest("li") ?? heading;
}

const hasLine = (name: string): boolean =>
  screen.queryByRole("heading", { level: 2, name }) !== null;

beforeEach(() => {
  localStorage.clear();
  document.title = "";
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("the cart screen", () => {
  it("shows the photo of each product, as decoration since the name is beside it", async () => {
    stubApi(catalogueOf(SAKAFO));
    seedCart([SAKAFO.id, 1]);
    renderAt("/panier");

    const photo = (await findLine("Sakafo")).querySelector("img");

    expect(photo?.getAttribute("src")).toBe("/media/products/sakafo.jpg");
    expect(photo?.getAttribute("alt")).toBe("");
  });

  it("keeps the line, with an empty square, for a product without a photo", async () => {
    const withoutPhoto = buildProduct({
      id: buildProductId(4),
      name: "Ranonapango",
      image: { url: null, alt: "Photo à venir" },
    });
    stubApi(catalogueOf(withoutPhoto));
    seedCart([withoutPhoto.id, 1]);
    renderAt("/panier");

    const line = await findLine("Ranonapango");

    expect(line.querySelector("img")).toBeNull();
    expect(line.textContent).not.toContain("Photo à venir");
  });

  it("keeps the empty square when the photo cannot be loaded", async () => {
    stubApi(catalogueOf(SAKAFO));
    seedCart([SAKAFO.id, 1]);
    renderAt("/panier");
    const line = await findLine("Sakafo");

    fireEvent.error(line.querySelector("img") ?? line);

    expect(line.querySelector("img")).toBeNull();
    expect(line.textContent).not.toContain("Photo à venir");
  });

  it("has a header with the way back to the catalogue and the screen title, and no cart link", async () => {
    stubApi(catalogueOf(SAKAFO));
    renderAt("/panier");
    await screen.findByText(texts.cart.screen.empty.text);

    const banner = within(screen.getByRole("banner"));

    expect(banner.getByRole("link", { name: texts.shell.back }).getAttribute("href")).toBe("/");
    expect(banner.getByText(texts.cart.screen.title)).toBeTruthy();
    expect(banner.queryByRole("link", { name: /Voir le panier/ })).toBeNull();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  });

  it("shows each line with its name, quantity and line price (the unit price is not shown)", async () => {
    stubApi(catalogueOf(SAKAFO, MOFO));
    seedCart([SAKAFO.id, 2], [MOFO.id, 1]);
    renderAt("/panier");

    const sakafo = within(await findLine("Sakafo"));

    expect(sakafo.queryByText("4 500 Ar")).toBeNull();
    expect(sakafo.getByRole("group", { name: "Quantité — Sakafo" }).textContent).toContain("2");
    expect(sakafo.getByText("9 000 Ar")).toBeTruthy();
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(texts.cart.screen.heading);
  });

  it("updates the line and the subtotal when the quantity changes", async () => {
    stubApi(catalogueOf(SAKAFO, MOFO));
    seedCart([SAKAFO.id, 2], [MOFO.id, 1]);
    renderAt("/panier");
    await screen.findByText("12 000 Ar");

    fireEvent.click(screen.getByRole("button", { name: "Ajouter une unité de Sakafo" }));

    expect(within(await findLine("Sakafo")).getByText("13 500 Ar")).toBeTruthy();
    expect(screen.getByText("16 500 Ar")).toBeTruthy();
  });

  it("shows the subtotal of the lines at the catalogue prices, and no delivery fee", async () => {
    stubApi(catalogueOf(SAKAFO, MOFO));
    seedCart([SAKAFO.id, 2], [MOFO.id, 1]);
    renderAt("/panier");

    const subtotal = await screen.findByText(texts.cart.screen.subtotal);

    // 2 x 4 500 + 1 x 3 000
    expect(subtotal.parentElement?.textContent).toContain("12 000 Ar");
    expect(screen.queryByText(texts.delivery.fee.label)).toBeNull();
  });

  it("removes the line at quantity 1 and puts the focus on the next line", async () => {
    stubApi(catalogueOf(SAKAFO, MOFO));
    seedCart([SAKAFO.id, 1], [MOFO.id, 1]);
    renderAt("/panier");
    await findLine("Sakafo");

    fireEvent.click(screen.getByRole("button", { name: "Retirer Sakafo du panier" }));

    expect(hasLine("Sakafo")).toBe(false);
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Retirer Mofo du panier" }),
    );
  });

  it("puts the focus on the previous line when the last one is removed", async () => {
    stubApi(catalogueOf(SAKAFO, MOFO));
    seedCart([SAKAFO.id, 1], [MOFO.id, 1]);
    renderAt("/panier");
    await findLine("Mofo");

    fireEvent.click(screen.getByRole("button", { name: "Retirer Mofo du panier" }));

    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Retirer Sakafo du panier" }),
    );
  });

  it("shows the empty state, with the way back, once the last line is removed", async () => {
    stubApi(catalogueOf(SAKAFO));
    seedCart([SAKAFO.id, 1]);
    renderAt("/panier");
    await findLine("Sakafo");

    fireEvent.click(screen.getByRole("button", { name: "Retirer Sakafo du panier" }));

    const back = screen.getByRole("link", { name: texts.cart.screen.empty.action });
    expect(back.getAttribute("href")).toBe("/");
    expect(document.activeElement).toBe(back);
    expect(screen.getByText(texts.cart.screen.empty.text)).toBeTruthy();
    expect(screen.queryByText(texts.cart.screen.subtotal)).toBeNull();
  });

  it("shows the empty state of an empty cart without a subtotal", async () => {
    stubApi(catalogueOf(SAKAFO));
    renderAt("/panier");

    expect(await screen.findByText(texts.cart.screen.empty.text)).toBeTruthy();
    expect(screen.queryByText(texts.cart.screen.subtotal)).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("shows line skeletons, no subtotal and no control while the catalogue loads", () => {
    stubApi(() => new Promise<Response>(() => undefined));
    seedCart([SAKAFO.id, 2]);
    renderAt("/panier");

    const busy = document.querySelector('[aria-busy="true"]');
    expect(busy?.textContent).toBe(texts.common.loading);
    expect(screen.queryByText(texts.cart.screen.subtotal)).toBeNull();
    expect(screen.queryByRole("group")).toBeNull();
  });

  it("shows a red notice when the catalogue fails, and retries it", async () => {
    let answer = (): Promise<Response> => Promise.resolve(problemResponse(500));
    const fetchStub = stubApi(() => answer());
    seedCart([SAKAFO.id, 2]);
    renderAt("/panier");
    await screen.findByRole("alert");
    expect(screen.queryByRole("group")).toBeNull();
    expect(screen.queryByText(texts.cart.screen.subtotal)).toBeNull();
    answer = catalogueOf(SAKAFO);

    fireEvent.click(screen.getByRole("button", { name: texts.common.retry }));

    expect(await findLine("Sakafo")).toBeTruthy();
    expect(fetchStub).toHaveBeenCalledWith("/api/v1/products", expect.anything());
  });

  it("loads the catalogue when the cart is opened directly", async () => {
    const fetchStub = stubApi(catalogueOf(SAKAFO));
    seedCart([SAKAFO.id, 1]);
    renderAt("/panier");

    await findLine("Sakafo");

    expect(fetchStub.mock.calls.filter(([url]) => url === "/api/v1/products")).toHaveLength(1);
  });

  it("removes a product that is no longer available and tells it once, on the cart screen", async () => {
    stubApi(catalogueOf(SAKAFO, SOLD_OUT));
    seedCart([SAKAFO.id, 1], [SOLD_OUT.id, 1]);
    renderAt("/panier");

    await waitFor(() => {
      expect(screen.getAllByText(texts.cart.removedUnavailable)).toHaveLength(1);
    });
    expect(hasLine("Koba")).toBe(false);
    expect(hasLine("Sakafo")).toBe(true);
  });

  it("shows a product name as plain text", async () => {
    const hostile = buildProduct({ id: buildProductId(9), name: "<img src=x onerror=alert(1)>" });
    stubApi(catalogueOf(hostile));
    seedCart([hostile.id, 1]);
    renderAt("/panier");

    const item = await findLine("<img src=x onerror=alert(1)>");

    // The product's own photo is an img; the one the name tries to inject (src "x") must not exist.
    expect(item.querySelector('img[src="x"]')).toBeNull();
  });

  it("has no accessibility violation on the whole page with lines", async () => {
    stubApi(catalogueOf(SAKAFO, MOFO));
    seedCart([SAKAFO.id, 2], [MOFO.id, 1]);
    renderAt("/panier");
    await findLine("Mofo");

    await expectNoAccessibilityViolations(document.body);
  });
});

describe("the route and the cart badge", () => {
  it("links the badge to the cart, named with the number of articles", async () => {
    stubApi(catalogueOf(SAKAFO));
    seedCart([SAKAFO.id, 3]);
    renderAt("/");

    const badge = screen.getByRole("link", { name: "Voir le panier, 3 articles" });

    expect(badge.getAttribute("href")).toBe("/panier");
    await screen.findByRole("heading", { name: "Sakafo" });
  });

  it("names the badge without a number when the cart is empty", async () => {
    stubApi(catalogueOf(SAKAFO));
    renderAt("/");

    expect(screen.getByRole("link", { name: "Voir le panier" })).toBeTruthy();
    await screen.findByRole("heading", { name: "Sakafo" });
  });

  it("opens the cart from the badge: title, focus on the main area, current step", async () => {
    stubApi(catalogueOf(SAKAFO));
    seedCart([SAKAFO.id, 1]);
    renderAt("/");
    await screen.findByRole("heading", { name: "Sakafo" });

    fireEvent.click(screen.getByRole("link", { name: "Voir le panier, 1 article" }));

    expect(await screen.findByRole("heading", { level: 1, name: "Votre panier" })).toBeTruthy();
    await waitFor(() => {
      expect(document.title).toBe("Panier — Maison Démo");
    });
    expect(document.activeElement).toBe(screen.getByRole("main"));
    const steps = screen.getByRole("navigation", { name: texts.shell.steps.label });
    expect(within(steps).getByText(texts.shell.steps.cart).closest("[aria-current]")).toBeTruthy();
    expect(within(steps).queryAllByRole("link")).toHaveLength(0);
  });
});
