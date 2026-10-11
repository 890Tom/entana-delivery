import { QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
import { expect, vi } from "vitest";

import { App } from "../../app";
import { createQueryClient } from "../../data-fetching/query-client";
import { CART_STORAGE_KEY } from "../../features/cart/storage/cart-storage";
import { MAP_LOADER_CONTEXT } from "../../features/delivery/map/map-loader-context";
import { texts } from "../../i18n/texts";

import { buildInstance } from "../builders/build-instance";
import { buildProduct, buildProductId } from "../builders/build-product";
import type { FakeMap, FakeMapLoader } from "../stubs/fake-map";
import { jsonResponse } from "../stubs/stub-fetch";

export const INSTANCE = buildInstance({
  map: {
    styleUrl: "https://style.example/custom",
    center: { lat: -18.8, lng: 47.4 },
    zoom: 13,
  },
});
const PRODUCT = buildProduct({ id: buildProductId(1) });
// The coordinates used by the tests: none of them may ever be written anywhere.
export const TAPPED = { lat: -18.9123456789, lng: 47.5123456789 };
export const TAPPED_ROUNDED = { lat: -18.912346, lng: 47.512346 };

/** The network boundary, answered by address: the instance and the catalogue. */
export function stubApi(): ReturnType<typeof vi.fn> {
  const fetchStub = vi.fn((input: RequestInfo | URL) =>
    Promise.resolve(
      input === "/api/v1/instance" ? jsonResponse(INSTANCE) : jsonResponse({ products: [PRODUCT] }),
    ),
  );
  vi.stubGlobal("fetch", fetchStub);
  return fetchStub;
}

/** A cart with one product, in a new session: the delivery draft of an earlier test is gone. */
export function seedCart(): void {
  sessionStorage.clear();
  localStorage.setItem(
    CART_STORAGE_KEY,
    JSON.stringify({ version: 1, lines: [{ productId: PRODUCT.id, quantity: 1 }] }),
  );
}

function renderApp(fake: FakeMapLoader): ReturnType<typeof render> {
  return render(
    <QueryClientProvider client={createQueryClient()}>
      <MAP_LOADER_CONTEXT value={fake.loader}>
        <App />
      </MAP_LOADER_CONTEXT>
    </QueryClientProvider>,
  );
}

export function renderAt(path: string, fake: FakeMapLoader): ReturnType<typeof render> {
  window.history.pushState({}, "", path);
  return renderApp(fake);
}

/** The delivery screen with a cart, and the map load asked for (not yet settled). */
export async function renderDelivery(fake: FakeMapLoader): Promise<void> {
  stubApi();
  seedCart();
  renderAt("/livraison", fake);
  await waitFor(() => {
    expect(fake.loader).toHaveBeenCalledOnce();
  });
}

/** Settles the pending map load as a success and waits for the map to be usable. */
export async function readyMap(fake: FakeMapLoader): Promise<FakeMap> {
  const map = act(() => fake.succeed());
  await screen.findByRole("button", { name: texts.delivery.place });
  return map;
}

export const placeButton = (): HTMLElement =>
  screen.getByRole("button", { name: texts.delivery.place });
export const locateButton = (): HTMLElement =>
  screen.getByRole("button", { name: texts.delivery.locate });

export const landmarkField = (): HTMLInputElement =>
  screen.getByRole<HTMLInputElement>("textbox", { name: texts.delivery.landmark.label });

/** The two "Continuer" of the page: the one of the fixed bar, then the one of the side card. */
export function continueButtons(): { readonly bar: HTMLElement; readonly card: HTMLElement } {
  const buttons = screen.getAllByRole("button", { name: texts.delivery.continue });
  const bar = buttons.find((button) => button.closest("form") === null);
  const card = buttons.find((button) => button.closest("form") !== null);
  if (bar === undefined || card === undefined || buttons.length !== 2) {
    throw new Error("The page must hold one Continuer in the bar and one in the form");
  }
  return { bar, card };
}
