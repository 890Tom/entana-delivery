import { formatAmount } from "@entana/contracts";
import type { PublicProduct } from "@entana/contracts";
import { QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createQueryClient } from "../query-client";
import { buildProduct, buildProductId } from "../test-support/build-product";
import { expectNoAccessibilityViolations } from "../test-support/expect-no-accessibility-violations";
import {
  jsonResponse,
  pendingUntilAborted,
  problemResponse,
  stubFetch,
} from "../test-support/stub-fetch";
import { texts } from "../texts";

import { Catalogue } from "./catalogue";

const SCRIPT = "<script>alert(1)</script>";
const IMAGE = '<img src="x" onerror="alert(1)">';

// formatAmount uses non-breaking spaces, which the default text matcher would turn into spaces.
const keepSpaces = { normalizer: (text: string): string => text };

function renderCatalogue(): ReturnType<typeof render> {
  return render(
    <QueryClientProvider client={createQueryClient()}>
      <Catalogue />
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.useRealTimers();
  cleanup();
  vi.unstubAllGlobals();
});

describe("Catalogue loading state", () => {
  it("shows the loading text while the request is pending", () => {
    stubFetch(pendingUntilAborted);

    renderCatalogue();

    expect(screen.getByRole("status").textContent).toBe(texts.catalogue.loading);
  });

  it("has no accessibility violation", async () => {
    stubFetch(pendingUntilAborted);

    const { container } = renderCatalogue();

    await expectNoAccessibilityViolations(container);
  });

  it("aborts the request when the component unmounts", () => {
    const stub = stubFetch(pendingUntilAborted);
    const { unmount } = renderCatalogue();

    unmount();

    expect(stub.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
  });
});

describe("Catalogue empty state", () => {
  it("says that no product is available", async () => {
    stubFetch(() => Promise.resolve(jsonResponse({ products: [] })));

    renderCatalogue();

    expect(await screen.findByText(texts.catalogue.empty)).toBeTruthy();
    expect(screen.queryByRole("list")).toBeNull();
  });

  it("has no accessibility violation", async () => {
    stubFetch(() => Promise.resolve(jsonResponse({ products: [] })));
    const { container } = renderCatalogue();
    await screen.findByText(texts.catalogue.empty);

    await expectNoAccessibilityViolations(container);
  });
});

describe("Catalogue error state", () => {
  it.each([
    ["server", () => Promise.resolve(problemResponse(503))],
    ["network", () => Promise.reject(new TypeError("Failed to fetch"))],
    ["unexpected", () => Promise.resolve(jsonResponse({ products: [], total: 0 }))],
  ] as const)("shows the fixed %s message and a retry button", async (kind, respond) => {
    stubFetch(respond);

    renderCatalogue();

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain(texts.catalogue.errors[kind]);
    expect(screen.getByRole("button", { name: texts.catalogue.retry })).toBeTruthy();
  });

  it("shows the timeout message after 10 seconds", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    stubFetch(pendingUntilAborted);
    renderCatalogue();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain(texts.catalogue.errors.timeout);
  });

  it("never shows the text sent by the server", async () => {
    stubFetch(() => Promise.resolve(problemResponse(500)));

    const { container } = renderCatalogue();
    await screen.findByRole("alert");

    expect(container.textContent).not.toContain("SECRET");
    expect(container.textContent).not.toContain("/api/");
  });

  it("has no accessibility violation", async () => {
    stubFetch(() => Promise.resolve(problemResponse(500)));
    const { container } = renderCatalogue();
    await screen.findByRole("alert");

    await expectNoAccessibilityViolations(container);
  });

  it("requests again on retry and shows the products when it recovers", async () => {
    const product = buildProduct({ name: "Vary" });
    const answers = [problemResponse(503), jsonResponse({ products: [product] })];
    const stub = stubFetch(() => Promise.resolve(answers.shift() ?? problemResponse(500)));
    renderCatalogue();

    fireEvent.click(await screen.findByRole("button", { name: texts.catalogue.retry }));

    expect(await screen.findByText(product.name)).toBeTruthy();
    expect(stub).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("keeps the error and the retry button when the retry fails too", async () => {
    const stub = stubFetch(() => Promise.resolve(problemResponse(503)));
    renderCatalogue();

    fireEvent.click(await screen.findByRole("button", { name: texts.catalogue.retry }));

    await waitFor(() => {
      expect(stub).toHaveBeenCalledTimes(2);
    });
    expect((await screen.findByRole("alert")).textContent).toContain(texts.catalogue.errors.server);
    expect(screen.getByRole("button", { name: texts.catalogue.retry })).toBeTruthy();
  });

  it("shows the loading text while a retry is pending", async () => {
    let call = 0;
    stubFetch((init) => {
      call += 1;
      return call === 1 ? Promise.resolve(problemResponse(500)) : pendingUntilAborted(init);
    });
    const { container } = renderCatalogue();

    fireEvent.click(await screen.findByRole("button", { name: texts.catalogue.retry }));

    await waitFor(() => {
      expect(screen.getByRole("status").textContent).toBe(texts.catalogue.loading);
    });
    await expectNoAccessibilityViolations(container);
  });
});

describe("Catalogue list state", () => {
  it("shows the products in the order of the response, with name and image alt", async () => {
    const products = [
      buildProduct({ id: buildProductId(1), name: "Sakafo", image: { key: "a", alt: "Photo A" } }),
      buildProduct({ id: buildProductId(2), name: "Mofo", image: { key: "b", alt: "Photo B" } }),
    ];
    stubFetch(() => Promise.resolve(jsonResponse({ products })));

    renderCatalogue();

    const items = await screen.findAllByRole("listitem");
    expect(items.map((item) => item.textContent)).toStrictEqual([
      expect.stringContaining("SakafoPhoto A"),
      expect.stringContaining("MofoPhoto B"),
    ]);
  });

  it.each([800, 12500, 1250000])("shows a price of %i as formatted ariary", async (priceAr) => {
    stubFetch(() => Promise.resolve(jsonResponse({ products: [buildProduct({ priceAr })] })));

    renderCatalogue();

    expect(await screen.findByText(formatAmount(priceAr), keepSpaces)).toBeTruthy();
  });

  it("shows the price of a sold-out product too", async () => {
    const product = buildProduct({ available: false, priceAr: 2000 });
    stubFetch(() => Promise.resolve(jsonResponse({ products: [product] })));

    renderCatalogue();

    expect(await screen.findByText(formatAmount(2000), keepSpaces)).toBeTruthy();
  });

  it("builds no image element and no URL from the image key", async () => {
    stubFetch(() => Promise.resolve(jsonResponse({ products: [buildProduct()] })));

    const { container } = renderCatalogue();
    await screen.findByText("Sakafo");

    expect(container.querySelectorAll("img, a, [src], [href]")).toHaveLength(0);
    expect(container.innerHTML).not.toContain("demo/sakafo.jpg");
  });

  it("marks an unavailable product as sold out, and only that one", async () => {
    const products = [
      buildProduct({ id: buildProductId(1), name: "Sakafo", available: true }),
      buildProduct({ id: buildProductId(2), name: "Mofo", available: false }),
    ];
    stubFetch(() => Promise.resolve(jsonResponse({ products })));

    renderCatalogue();

    const items = await screen.findAllByRole("listitem");
    expect(items[0]?.textContent).not.toContain(texts.catalogue.soldOut);
    expect(items[1]?.textContent).toContain("Épuisé");
  });

  it("shows the description when there is one", async () => {
    const product = buildProduct({ description: "Riz et zebu" });
    stubFetch(() => Promise.resolve(jsonResponse({ products: [product] })));

    renderCatalogue();

    expect(await screen.findByText("Riz et zebu")).toBeTruthy();
  });

  it.each([
    ["null", null],
    ["empty", ""],
  ])("renders nothing for a %s description", async (_label, description) => {
    const product = buildProduct({ description });
    stubFetch(() => Promise.resolve(jsonResponse({ products: [product] })));

    renderCatalogue();

    const item = await screen.findByRole("listitem");
    expect(item.textContent).toBe(
      `${product.name}${product.image.alt}${formatAmount(product.priceAr)}`,
    );
  });

  it.each<[string, Partial<PublicProduct>, string]>([
    ["script in the name", { name: SCRIPT }, SCRIPT],
    ["image in the name", { name: IMAGE }, IMAGE],
    ["image in the description", { description: IMAGE }, IMAGE],
    ["image in the image alt", { image: { key: "demo/x.jpg", alt: IMAGE } }, IMAGE],
  ])("shows markup as plain text: %s", async (_label, overrides, visibleText) => {
    const product = buildProduct(overrides);
    stubFetch(() => Promise.resolve(jsonResponse({ products: [product] })));

    const { container } = renderCatalogue();

    expect(await screen.findByText(visibleText)).toBeTruthy();
    expect(container.querySelectorAll("script, img, [onerror]")).toHaveLength(0);
  });

  it("has no accessibility violation", async () => {
    const products = [
      buildProduct({ id: buildProductId(1), description: "Riz" }),
      buildProduct({ id: buildProductId(2), available: false }),
    ];
    stubFetch(() => Promise.resolve(jsonResponse({ products })));
    const { container } = renderCatalogue();
    await screen.findAllByRole("listitem");

    await expectNoAccessibilityViolations(container);
  });
});
