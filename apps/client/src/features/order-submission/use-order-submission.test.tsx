import { QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import type { ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createQueryClient } from "../../data-fetching/query-client";
import { buildInstance } from "../../test-support/builders/build-instance";
import { CREATED_BODY } from "../../test-support/builders/build-order-submission";
import { buildProductId } from "../../test-support/builders/build-product";
import { resetOrderSubmission } from "../../test-support/order-submission/reset-order-submission";
import { jsonResponse } from "../../test-support/stubs/stub-fetch";
import { CART_STORAGE_KEY } from "../cart/storage/cart-storage";
import { CartProvider } from "../cart/cart-state/cart-provider";
import { ContactDraftProvider } from "../contact/contact-draft/contact-draft-provider";
import { CONTACT_DRAFT_STORAGE_KEY } from "../contact/contact-draft/contact-draft-storage";
import { DeliveryDraftProvider } from "../delivery/delivery-draft/delivery-draft-provider";
import { DELIVERY_DRAFT_STORAGE_KEY } from "../delivery/delivery-draft/delivery-draft-storage";

import { CONFIRMED_ORDERS_STORAGE_KEY } from "./storage/confirmed-orders-storage";
import { useOrderSubmission } from "./use-order-submission";

const PRODUCT = buildProductId(1);

function Probe(): ReactElement {
  const { state, send, retry } = useOrderSubmission();
  return (
    <>
      <button type="button" onClick={send}>
        send
      </button>
      <button type="button" onClick={retry}>
        retry
      </button>
      <p data-testid="state">{JSON.stringify(state)}</p>
    </>
  );
}

function Page(): ReactElement {
  const [isShown, setIsShown] = useState(true);
  return (
    <>
      <button
        type="button"
        onClick={() => {
          setIsShown(false);
        }}
      >
        leave
      </button>
      {isShown ? <Probe /> : null}
    </>
  );
}

function renderPage(): void {
  render(
    <QueryClientProvider client={createQueryClient()}>
      <CartProvider>
        <DeliveryDraftProvider>
          <ContactDraftProvider>
            <Page />
          </ContactDraftProvider>
        </DeliveryDraftProvider>
      </CartProvider>
    </QueryClientProvider>,
  );
}

function seedStorages(): void {
  localStorage.setItem(
    CART_STORAGE_KEY,
    JSON.stringify({ version: 1, lines: [{ productId: PRODUCT, quantity: 1 }] }),
  );
  sessionStorage.setItem(
    DELIVERY_DRAFT_STORAGE_KEY,
    JSON.stringify({
      version: 1,
      point: { lat: -18.912346, lng: 47.512346 },
      landmark: "Portail bleu",
    }),
  );
  sessionStorage.setItem(
    CONTACT_DRAFT_STORAGE_KEY,
    JSON.stringify({ version: 1, name: "Rakoto Jean", phone: "34 12 345 67", note: null }),
  );
}

const stateText = (): string => screen.getByTestId("state").textContent;

beforeEach(() => {
  resetOrderSubmission();
  seedStorages();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/** The instance answers at once; the order is whatever `order` returns. */
function stubApi(order: () => Promise<Response>): void {
  vi.stubGlobal(
    "fetch",
    vi.fn((input: RequestInfo | URL) =>
      input === "/api/v1/instance" ? Promise.resolve(jsonResponse(buildInstance())) : order(),
    ),
  );
}

async function sendOnceTheInstanceIsKnown(): Promise<void> {
  await waitFor(() => {
    expect(vi.mocked(fetch)).toHaveBeenCalledWith("/api/v1/instance", expect.anything());
  });
  // The country code comes with the instance: the answer is awaited before the customer sends.
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  await act(async () => {
    screen.getByRole("button", { name: "send" }).click();
    await Promise.resolve();
  });
}

describe("the order submission hook", () => {
  it("exposes the ids of the unavailable products", async () => {
    const problem = {
      type: "about:blank",
      title: "Unprocessable Entity",
      status: 422,
      detail: "Some products are not available.",
      instance: "/api/v1/orders",
      productIds: [PRODUCT],
    };
    stubApi(() => Promise.resolve(jsonResponse(problem, 422)));
    renderPage();

    await sendOnceTheInstanceIsKnown();

    await waitFor(() => {
      expect(JSON.parse(stateText())).toEqual({
        status: "error",
        error: { type: "unavailable_products", productIds: [PRODUCT] },
      });
    });
  });

  it("starts a new mount in idle after a failure", async () => {
    stubApi(() => Promise.reject(new TypeError("Failed to fetch")));
    renderPage();
    await sendOnceTheInstanceIsKnown();
    await waitFor(() => {
      expect(stateText()).toContain("network");
    });

    cleanup();
    renderPage();

    expect(JSON.parse(stateText())).toEqual({ status: "idle" });
  });

  it("does not replay by itself once the hook is gone", async () => {
    const orderRequests = vi.fn(() => Promise.reject(new TypeError("Failed to fetch")));
    stubApi(orderRequests);
    renderPage();
    await sendOnceTheInstanceIsKnown();
    await waitFor(() => {
      expect(stateText()).toContain("network");
    });
    act(() => {
      screen.getByRole("button", { name: "leave" }).click();
    });

    window.dispatchEvent(new Event("online"));
    await act(async () => {
      await Promise.resolve();
    });

    expect(orderRequests).toHaveBeenCalledOnce();
  });

  it("records the order and empties the cart and the drafts after the page was left", async () => {
    let answer: (response: Response) => void = () => undefined;
    stubApi(
      () =>
        new Promise<Response>((resolve) => {
          answer = resolve;
        }),
    );
    renderPage();
    await sendOnceTheInstanceIsKnown();

    act(() => {
      screen.getByRole("button", { name: "leave" }).click();
    });
    await act(async () => {
      answer(jsonResponse(CREATED_BODY, 201));
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(localStorage.getItem(CONFIRMED_ORDERS_STORAGE_KEY)).toContain("K7M2QX");
    });
    expect(localStorage.getItem(CART_STORAGE_KEY)).toContain('"lines":[]');
    expect(sessionStorage.getItem(DELIVERY_DRAFT_STORAGE_KEY)).toBeNull();
    expect(sessionStorage.getItem(CONTACT_DRAFT_STORAGE_KEY)).toBeNull();
  });
});
