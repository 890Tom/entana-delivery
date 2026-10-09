import { QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { App } from "./app";
import { createQueryClient } from "./data-fetching/query-client";
import { texts } from "./i18n/texts";
import { buildProduct, buildProductId } from "./test-support/build-product";
import { expectNoAccessibilityViolations } from "./test-support/expect-no-accessibility-violations";
import { jsonResponse, problemResponse, stubFetch } from "./test-support/stub-fetch";

function renderApp(respond: () => Promise<Response>): ReturnType<typeof render> {
  stubFetch(respond);
  return render(
    <QueryClientProvider client={createQueryClient()}>
      <App />
    </QueryClientProvider>,
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("App", () => {
  it("has one main landmark and one main heading, the catalogue title", async () => {
    renderApp(() => Promise.resolve(jsonResponse({ products: [] })));

    expect(screen.getAllByRole("main")).toHaveLength(1);
    expect(
      screen.getAllByRole("heading", { level: 1 }).map((heading) => heading.textContent),
    ).toEqual([texts.catalogue.title]);
    await screen.findByText(texts.catalogue.empty);
  });

  it("has no accessibility violation with products, an unavailable one included", async () => {
    const products = [
      buildProduct({ id: buildProductId(1), description: "Riz" }),
      buildProduct({ id: buildProductId(2), available: false }),
    ];
    const { container } = renderApp(() => Promise.resolve(jsonResponse({ products })));
    await screen.findAllByRole("listitem");

    await expectNoAccessibilityViolations(container);
  });

  it("has no accessibility violation in the error state", async () => {
    const { container } = renderApp(() => Promise.resolve(problemResponse(500)));
    await screen.findByRole("alert");

    await expectNoAccessibilityViolations(container);
  });
});
