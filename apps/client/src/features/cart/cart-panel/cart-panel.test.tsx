import { QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "../../../app";
import { createQueryClient } from "../../../data-fetching/query-client";
import { texts } from "../../../i18n/texts";
import { DELIVERY_PATH } from "../../../routes";
import { buildInstance } from "../../../test-support/build-instance";
import { buildProduct, buildProductId } from "../../../test-support/build-product";
import { expectNoAccessibilityViolations } from "../../../test-support/expect-no-accessibility-violations";
import { jsonResponse, problemResponse } from "../../../test-support/stub-fetch";
import { CART_STORAGE_KEY } from "../cart-storage";

const SAKAFO = buildProduct({ id: buildProductId(1), name: "Sakafo", priceAr: 4500 });
const MOFO = buildProduct({ id: buildProductId(2), name: "Mofo", priceAr: 3000 });

function stubApi(products: () => Promise<Response>): void {
  vi.stubGlobal(
    "fetch",
    vi.fn((input: RequestInfo | URL) =>
      input === "/api/v1/instance" ? Promise.resolve(jsonResponse(buildInstance())) : products(),
    ),
  );
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

const findPanel = (): Promise<HTMLElement> =>
  screen.findByRole("complementary", { name: texts.cart.panel.title });

interface CartSummary {
  readonly lines: readonly string[];
  readonly subtotal: string;
}

/** What a cart shows, whichever screen it is on: the text of each line, and the subtotal row. */
async function readSummary(container: HTMLElement): Promise<CartSummary> {
  const scope = within(container);
  const subtotal = await scope.findByText(texts.cart.screen.subtotal);
  return {
    lines: scope.getAllByRole("listitem").map((line) => line.textContent),
    subtotal: subtotal.parentElement?.textContent ?? "",
  };
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("the side cart", () => {
  it("shows the same lines and subtotal as the cart screen for the same cart", async () => {
    stubApi(catalogueOf(SAKAFO, MOFO));
    seedCart([SAKAFO.id, 2], [MOFO.id, 1]);
    renderAt("/panier");
    const onScreen = await readSummary(await screen.findByRole("main"));
    cleanup();

    renderAt("/");
    const inPanel = await readSummary(await findPanel());

    expect(inPanel).toEqual(onScreen);
    expect(inPanel.subtotal).toBe(`${texts.cart.screen.subtotal}12\u00a0000\u00a0Ar`);
  });

  it("is a named complementary landmark, outside the main area, and not on the cart screen", async () => {
    stubApi(catalogueOf(SAKAFO));
    renderAt("/");

    const panel = await findPanel();

    expect(screen.getByRole("main").contains(panel)).toBe(false);
    cleanup();
    renderAt("/panier");
    await screen.findByRole("main");
    expect(screen.queryByRole("complementary")).toBeNull();
  });

  it("updates the header badge and the subtotal when a quantity changes in the panel", async () => {
    stubApi(catalogueOf(SAKAFO, MOFO));
    seedCart([SAKAFO.id, 2], [MOFO.id, 1]);
    renderAt("/");
    const panel = within(await findPanel());
    await panel.findByText("12 000 Ar");

    fireEvent.click(panel.getByRole("button", { name: "Ajouter une unité de Sakafo" }));

    expect(panel.getByText("16 500 Ar")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Voir le panier, 4 articles" })).toBeTruthy();
  });

  it("leads to the delivery step with a link, and says that no account is needed", async () => {
    stubApi(catalogueOf(SAKAFO));
    seedCart([SAKAFO.id, 1]);
    renderAt("/");
    const panel = within(await findPanel());

    const next = await panel.findByRole("link", { name: texts.cart.screen.continue });

    expect(next.getAttribute("href")).toBe(DELIVERY_PATH);
    expect(panel.getByText(texts.cart.panel.noAccount)).toBeTruthy();
  });

  it("shows the empty state without subtotal, link or caption", async () => {
    stubApi(catalogueOf(SAKAFO));
    renderAt("/");
    const panel = within(await findPanel());

    expect(await panel.findByText(texts.cart.panel.empty)).toBeTruthy();
    expect(panel.queryByText(texts.cart.screen.subtotal)).toBeNull();
    expect(panel.queryByRole("link")).toBeNull();
    expect(panel.queryByText(texts.cart.panel.noAccount)).toBeNull();
  });

  it("shows busy line skeletons, no subtotal and no control while the catalogue loads", async () => {
    stubApi(() => new Promise<Response>(() => undefined));
    seedCart([SAKAFO.id, 2]);
    renderAt("/");
    const panel = await findPanel();

    expect(panel.querySelector('[aria-busy="true"]')?.textContent).toBe(texts.common.loading);
    expect(within(panel).queryByText(texts.cart.screen.subtotal)).toBeNull();
    expect(within(panel).queryByRole("group")).toBeNull();
  });

  it("shows a notice with a retry when the catalogue fails, announced once for the page", async () => {
    let answer = (): Promise<Response> => Promise.resolve(problemResponse(500));
    stubApi(() => answer());
    seedCart([SAKAFO.id, 2]);
    renderAt("/");
    const panel = within(await findPanel());

    expect(await panel.findByText(texts.catalogue.errors.server)).toBeTruthy();
    expect(screen.getAllByRole("alert")).toHaveLength(1);
    answer = catalogueOf(SAKAFO);
    fireEvent.click(panel.getByRole("button", { name: texts.common.retry }));

    expect(await panel.findByRole("heading", { name: "Sakafo" })).toBeTruthy();
  });

  it("shows the photo of a line as decoration, since the name is beside it", async () => {
    stubApi(catalogueOf(SAKAFO));
    seedCart([SAKAFO.id, 1]);
    renderAt("/");
    const panel = await findPanel();

    await within(panel).findByRole("heading", { name: "Sakafo" });
    const photo = panel.querySelector("img");

    expect(photo?.getAttribute("src")).toBe("/media/products/sakafo.jpg");
    expect(photo?.getAttribute("alt")).toBe("");
  });

  it("has one live region per article and no duplicated identifier on the page", async () => {
    stubApi(catalogueOf(SAKAFO));
    seedCart([SAKAFO.id, 2]);
    renderAt("/");
    await findPanel();
    await screen.findAllByRole("group", { name: "Quantité — Sakafo" });

    const groups = screen.getAllByRole("group", { name: "Quantité — Sakafo" });
    const liveRegions = groups.flatMap((group) => [...group.querySelectorAll("[aria-live]")]);
    const identifiers = [...document.querySelectorAll("[id]")].map((element) => element.id);

    expect(groups).toHaveLength(2);
    expect(liveRegions).toHaveLength(1);
    expect(new Set(identifiers).size).toBe(identifiers.length);
  });

  it("has the page title as the only main heading, the panel title under it and the lines under that", async () => {
    stubApi(catalogueOf(SAKAFO));
    seedCart([SAKAFO.id, 1]);
    renderAt("/");
    const panel = within(await findPanel());

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(panel.getByRole("heading", { level: 2 }).textContent).toBe(texts.cart.panel.title);
    expect((await panel.findByRole("heading", { level: 3 })).textContent).toBe("Sakafo");
  });

  it("has no accessibility violation on the catalogue with its side cart", async () => {
    stubApi(catalogueOf(SAKAFO, MOFO));
    seedCart([SAKAFO.id, 2], [MOFO.id, 1]);
    window.history.pushState({}, "", "/");
    const { container } = render(
      <QueryClientProvider client={createQueryClient()}>
        <App />
      </QueryClientProvider>,
    );
    await waitFor(async () => {
      expect(await within(await findPanel()).findByText("12 000 Ar")).toBeTruthy();
    });

    await expectNoAccessibilityViolations(container);
  });
});
