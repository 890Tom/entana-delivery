import { QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "../app";
import { createQueryClient } from "../data-fetching/query-client";
import { texts } from "../i18n/texts";
import { buildInstance } from "../test-support/build-instance";
import { buildProduct } from "../test-support/build-product";
import { expectNoAccessibilityViolations } from "../test-support/expect-no-accessibility-violations";
import { jsonResponse, problemResponse } from "../test-support/stub-fetch";

const PRODUCTS = jsonResponse({ products: [buildProduct({ name: "Sakafo" })] });

// The network boundary, answered by address: the shell and the catalogue ask for two of them.
function stubApi(instance: () => Promise<Response>): void {
  vi.stubGlobal(
    "fetch",
    vi.fn((input: RequestInfo | URL) =>
      input === "/api/v1/instance" ? instance() : Promise.resolve(PRODUCTS.clone()),
    ),
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

const neverAnswers = (): Promise<Response> => new Promise<Response>(() => undefined);

beforeEach(() => {
  document.title = "";
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("application shell", () => {
  it("shows the shop name and the catalogue, without the steps of the order", async () => {
    stubApi(() => Promise.resolve(jsonResponse(buildInstance())));
    renderAt("/");

    const banner = screen.getByRole("banner");
    expect(await within(banner).findByText("Maison Démo")).toBeTruthy();
    expect(screen.queryByRole("navigation")).toBeNull();
    expect(await screen.findByText("Sakafo")).toBeTruthy();
  });

  it("shows the steps with the first one current on the cart", async () => {
    stubApi(() => Promise.resolve(jsonResponse(buildInstance())));
    renderAt("/panier");

    const steps = screen.getByRole("navigation", { name: texts.shell.steps.label });
    expect(within(steps).getByText(texts.shell.steps.cart).closest("[aria-current]")).toBeTruthy();
    expect(within(steps).getAllByRole("listitem")).toHaveLength(5);
    expect(steps.querySelectorAll('[aria-current="step"]')).toHaveLength(1);
    await screen.findByRole("heading", { level: 1 });
  });

  it("shows the position of the step on the cart", async () => {
    stubApi(() => Promise.resolve(jsonResponse(buildInstance())));
    renderAt("/panier");

    const steps = screen.getByRole("navigation", { name: texts.shell.steps.label });

    expect(within(steps).getByText(texts.shell.steps.position(1, 5))).toBeTruthy();
    await screen.findByRole("heading", { level: 1 });
  });

  it("does not make the following steps links", async () => {
    stubApi(() => Promise.resolve(jsonResponse(buildInstance())));
    renderAt("/panier");

    const steps = screen.getByRole("navigation", { name: texts.shell.steps.label });

    expect(within(steps).queryAllByRole("link")).toHaveLength(0);
    await screen.findByRole("heading", { level: 1 });
  });

  it("has one banner, one named navigation and one main", async () => {
    stubApi(() => Promise.resolve(jsonResponse(buildInstance())));
    renderAt("/panier");

    expect(screen.getAllByRole("banner")).toHaveLength(1);
    expect(screen.getAllByRole("navigation")).toHaveLength(1);
    expect(screen.getAllByRole("main")).toHaveLength(1);
    await screen.findByRole("heading", { level: 1 });
  });

  it("shows the logo alone, with the shop name as its alternative text", async () => {
    stubApi(() =>
      Promise.resolve(jsonResponse(buildInstance({ logoUrl: "/media/branding/logo.png" }))),
    );
    renderAt("/");

    const logo = await screen.findByRole("img", { name: "Maison Démo" });
    expect(logo.getAttribute("src")).toBe("/media/branding/logo.png");
    expect(screen.getByRole("link", { name: "Maison Démo - accueil" }).getAttribute("href")).toBe(
      "/",
    );
    expect(within(screen.getByRole("banner")).queryByText("Maison Démo")).toBeNull();
  });

  it("falls back to the shop name when the logo cannot be loaded", async () => {
    stubApi(() =>
      Promise.resolve(jsonResponse(buildInstance({ logoUrl: "/media/branding/logo.png" }))),
    );
    renderAt("/");

    fireEvent.error(await screen.findByRole("img", { name: "Maison Démo" }));

    expect(
      within(screen.getByRole("banner")).queryByRole("img", { name: "Maison Démo" }),
    ).toBeNull();
    expect(within(screen.getByRole("banner")).getByText("Maison Démo")).toBeTruthy();
  });

  it("shows a placeholder of the header while the instance loads", async () => {
    stubApi(neverAnswers);
    renderAt("/");

    const busy = screen.getByRole("banner").querySelector('[aria-busy="true"]');
    expect(busy?.textContent).toBe(texts.common.loading);
    expect(within(screen.getByRole("banner")).queryByRole("link", { name: /accueil/ })).toBeNull();
    await screen.findByText("Sakafo");
  });

  it("shows the generic name without logo when the instance cannot be loaded, and the catalogue", async () => {
    stubApi(() => Promise.resolve(problemResponse(500)));
    renderAt("/");

    expect(
      await within(screen.getByRole("banner")).findByText(texts.shell.genericName),
    ).toBeTruthy();
    expect(
      within(screen.getByRole("banner")).queryByRole("img", { name: texts.shell.genericName }),
    ).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(await screen.findByText("Sakafo")).toBeTruthy();
  });

  it("titles the document with the screen and the shop name", async () => {
    stubApi(() => Promise.resolve(jsonResponse(buildInstance())));
    renderAt("/");

    await waitFor(() => {
      expect(document.title).toBe(`${texts.catalogue.title} — Maison Démo`);
    });
  });

  it("shows a page not found with a link back, outside the step flow", async () => {
    stubApi(() => Promise.resolve(jsonResponse(buildInstance())));
    renderAt("/unknown");

    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(texts.notFound.title);
    expect(screen.getByRole("link", { name: texts.notFound.back }).getAttribute("href")).toBe("/");
    expect(screen.queryByRole("navigation")).toBeNull();
    await waitFor(() => {
      expect(document.title).toBe(`${texts.notFound.title} — Maison Démo`);
    });
  });

  it("moves the focus to the main area after a change of page", async () => {
    stubApi(() => Promise.resolve(jsonResponse(buildInstance())));
    renderAt("/unknown");

    fireEvent.click(screen.getByRole("link", { name: texts.notFound.back }));

    await screen.findByText("Sakafo");
    expect(document.activeElement).toBe(screen.getByRole("main"));
  });

  it("has no accessibility violation on the whole page with its header", async () => {
    stubApi(() =>
      Promise.resolve(jsonResponse(buildInstance({ logoUrl: "/media/branding/logo.png" }))),
    );
    const { container } = renderAt("/");
    await screen.findByText("Sakafo");
    await screen.findByRole("img", { name: "Maison Démo" });

    await expectNoAccessibilityViolations(container);
  });
});
