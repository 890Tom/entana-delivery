import { formatAmount } from "@entana/contracts";
import { QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createQueryClient } from "../../data-fetching/query-client";
import { buildProduct, buildProductId } from "../../test-support/build-product";
import {
  jsonResponse,
  pendingUntilAborted,
  problemResponse,
  stubFetch,
} from "../../test-support/stub-fetch";
import { texts } from "../../i18n/texts";
import { CartProvider } from "../cart/cart-state/cart-provider";

import { Catalogue } from "./catalogue";

// 8 cards, 4 of them hidden by CSS under 1024 px (screens/catalogue.md, section 7).
const SKELETON_CARD_COUNT = 8;
const SCRIPT = "<script>alert(1)</script>";
const IMAGE = '<img src="x" onerror="alert(1)">';

// formatAmount uses non-breaking spaces, which the default text matcher would turn into spaces.
const keepSpaces = { normalizer: (text: string): string => text };

function renderCatalogue(): ReturnType<typeof render> {
  return render(
    <QueryClientProvider client={createQueryClient()}>
      <CartProvider>
        <Catalogue />
      </CartProvider>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.useRealTimers();
  cleanup();
  vi.unstubAllGlobals();
});

describe("Catalogue loading state", () => {
  it("shows a busy skeleton grid that announces the loading", () => {
    stubFetch(pendingUntilAborted);

    const { container } = renderCatalogue();

    const busy = container.querySelector('[aria-busy="true"]');
    expect(busy?.textContent).toBe(texts.common.loading);
    const blocks = busy?.querySelector('[aria-hidden="true"]');
    expect(blocks?.children).toHaveLength(SKELETON_CARD_COUNT);
    expect(screen.queryByRole("list")).toBeNull();
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
    expect(screen.getByRole("button", { name: texts.common.retry })).toBeTruthy();
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

  it("requests again on retry and shows the products when it recovers", async () => {
    const product = buildProduct({ name: "Vary" });
    const answers = [problemResponse(503), jsonResponse({ products: [product] })];
    const stub = stubFetch(() => Promise.resolve(answers.shift() ?? problemResponse(500)));
    renderCatalogue();

    fireEvent.click(await screen.findByRole("button", { name: texts.common.retry }));

    expect(await screen.findByText(product.name)).toBeTruthy();
    expect(stub).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("keeps the error and the retry button when the retry fails too", async () => {
    const stub = stubFetch(() => Promise.resolve(problemResponse(503)));
    renderCatalogue();

    fireEvent.click(await screen.findByRole("button", { name: texts.common.retry }));

    await waitFor(() => {
      expect(stub).toHaveBeenCalledTimes(2);
    });
    expect((await screen.findByRole("alert")).textContent).toContain(texts.catalogue.errors.server);
    expect(screen.getByRole("button", { name: texts.common.retry })).toBeTruthy();
  });

  it("shows the skeleton again while a retry is pending", async () => {
    let call = 0;
    stubFetch((init) => {
      call += 1;
      return call === 1 ? Promise.resolve(problemResponse(500)) : pendingUntilAborted(init);
    });
    const { container } = renderCatalogue();

    fireEvent.click(await screen.findByRole("button", { name: texts.common.retry }));

    await waitFor(() => {
      expect(container.querySelector('[aria-busy="true"]')?.textContent).toBe(texts.common.loading);
    });
  });
});

describe("Catalogue list state", () => {
  it("shows the products in the order of the response, with name and image alt text", async () => {
    const products = [
      buildProduct({ id: buildProductId(1), name: "Sakafo", image: { url: null, alt: "Photo A" } }),
      buildProduct({ id: buildProductId(2), name: "Mofo", image: { url: null, alt: "Photo B" } }),
    ];
    stubFetch(() => Promise.resolve(jsonResponse({ products })));

    renderCatalogue();

    const items = await screen.findAllByRole("listitem");
    expect(items.map((item) => item.textContent)).toStrictEqual([
      expect.stringContaining("Photo ASakafo"),
      expect.stringContaining("Photo BMofo"),
    ]);
  });

  it("shows a price as formatted ariary", async () => {
    stubFetch(() =>
      Promise.resolve(jsonResponse({ products: [buildProduct({ priceAr: 12500 })] })),
    );

    renderCatalogue();

    expect(await screen.findByText(formatAmount(12500), keepSpaces)).toBeTruthy();
  });

  it("replaces the cart control of an unavailable product with a disabled button, and only that one", async () => {
    const products = [
      buildProduct({ id: buildProductId(1), name: "Sakafo", available: true }),
      buildProduct({ id: buildProductId(2), name: "Mofo", available: false }),
    ];
    stubFetch(() => Promise.resolve(jsonResponse({ products })));

    renderCatalogue();

    const items = await screen.findAllByRole("listitem");
    const label = texts.catalogue.product.unavailable;
    expect(items[0]?.textContent).not.toContain(label);
    const button = screen.getByRole("button", { name: label });
    expect(items[1]?.contains(button)).toBe(true);
    expect(button.getAttribute("aria-disabled")).toBe("true");
  });

  it("does not show the description on the card", async () => {
    const product = buildProduct({ description: "Riz et zebu" });
    stubFetch(() => Promise.resolve(jsonResponse({ products: [product] })));

    renderCatalogue();

    await screen.findByText(product.name);
    expect(screen.queryByText("Riz et zebu")).toBeNull();
  });

  it("shows markup in the name and the image alt text as plain text", async () => {
    const product = buildProduct({
      name: SCRIPT,
      image: { url: null, alt: IMAGE },
    });
    stubFetch(() => Promise.resolve(jsonResponse({ products: [product] })));

    const { container } = renderCatalogue();

    expect(await screen.findByText(SCRIPT)).toBeTruthy();
    expect(screen.getByText(IMAGE)).toBeTruthy();
    expect(container.querySelectorAll("script, img, [onerror]")).toHaveLength(0);
  });
});
