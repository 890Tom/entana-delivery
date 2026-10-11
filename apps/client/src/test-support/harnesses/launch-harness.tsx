import { vi } from "vitest";

import { LAUNCH_FLAG_STORAGE_ITEM } from "../../features/active-order/storage/launch-flag";
import { CART_STORAGE_KEY } from "../../features/cart/storage/cart-storage";
import { CONFIRMED_ORDERS_STORAGE_KEY } from "../../features/order-submission/storage/confirmed-orders-storage";

import { buildInstance } from "../builders/build-instance";
import { buildProduct, buildProductId } from "../builders/build-product";
import { renderAt } from "./delivery-harness";
import { createFakeMapLoader } from "../stubs/fake-map";
import { jsonResponse } from "../stubs/stub-fetch";
import { TOKEN, TRACKING_ADDRESS, viewAnswer } from "./tracking-harness";
import type { Answer } from "./tracking-harness";

export const PRODUCT = buildProduct({ id: buildProductId(1) });
export const OLDER_TOKEN = "C".repeat(43);

interface OpenOptions {
  /** The path the application is opened on. */
  readonly path?: string;
  /** What the tracking answers; an order that goes on by default. */
  readonly tracking?: Answer;
  /** The orders of the device, the most recent first. */
  readonly stored?: readonly { readonly code: string; readonly token: string }[];
  readonly hasCart?: boolean;
  /** The session already handled its opening (a reload in the same tab). */
  readonly isHandled?: boolean;
}

export interface LaunchApp {
  /** The requests of the tracking address, with the options they were sent with. */
  readonly trackingCalls: () => readonly (readonly [string, RequestInit | undefined])[];
}

/** The whole application, opened as a customer would, with the network stubbed. */
export function openApplication(options: OpenOptions = {}): LaunchApp {
  const fetchStub = vi.fn((input: RequestInfo | URL, _init?: RequestInit) => {
    switch (input) {
      case "/api/v1/instance":
        return Promise.resolve(jsonResponse(buildInstance()));
      case TRACKING_ADDRESS:
        return (options.tracking ?? viewAnswer({ status: "CONFIRMED" }))();
      default:
        return Promise.resolve(jsonResponse({ products: [PRODUCT] }));
    }
  });
  vi.stubGlobal("fetch", fetchStub);
  sessionStorage.clear();
  localStorage.clear();
  const orders = (options.stored ?? [{ code: "K7M2QX", token: TOKEN }]).map((order) => ({
    ...order,
    createdAt: new Date().toISOString(),
  }));
  if (orders.length > 0) {
    localStorage.setItem(CONFIRMED_ORDERS_STORAGE_KEY, JSON.stringify({ version: 1, orders }));
  }
  if (options.hasCart === true) {
    localStorage.setItem(
      CART_STORAGE_KEY,
      JSON.stringify({ version: 1, lines: [{ productId: PRODUCT.id, quantity: 1 }] }),
    );
  }
  if (options.isHandled === true) {
    sessionStorage.setItem(LAUNCH_FLAG_STORAGE_ITEM, "1");
  }
  renderAt(options.path ?? "/", createFakeMapLoader());
  return {
    trackingCalls: () =>
      fetchStub.mock.calls.filter(
        (call): call is [string, RequestInit | undefined] => call[0] === TRACKING_ADDRESS,
      ),
  };
}
