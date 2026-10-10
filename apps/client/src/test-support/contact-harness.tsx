import type { PublicInstance, PublicProduct } from "@entana/contracts";
import { cleanup, fireEvent, screen, within } from "@testing-library/react";
import { vi } from "vitest";

import { CART_STORAGE_KEY } from "../features/cart/storage/cart-storage";
import { CONTACT_DRAFT_STORAGE_KEY } from "../features/contact/contact-draft/contact-draft-storage";
import { DELIVERY_DRAFT_STORAGE_KEY } from "../features/delivery/delivery-draft/delivery-draft-storage";
import { texts } from "../i18n/texts";

import { buildInstance } from "./build-instance";
import { buildProduct, buildProductId } from "./build-product";
import { renderAt } from "./delivery-harness";
import { createFakeMapLoader } from "./fake-map";
import { jsonResponse, pendingUntilAborted, problemResponse } from "./stub-fetch";

type Answer = "ok" | "server-error" | "pending";

/** What the network answers; a test changes it between two requests (a retry). */
export interface ApiControl {
  instance: Answer;
  catalogue: Answer;
  readonly instanceData: PublicInstance;
  readonly products: readonly PublicProduct[];
}

export const SAKAFO = buildProduct({ id: buildProductId(1), name: "Sakafo", priceAr: 4500 });
export const MOFO = buildProduct({ id: buildProductId(2), name: "Mofo", priceAr: 3000 });
export const KOBA = buildProduct({
  id: buildProductId(3),
  name: "Koba",
  priceAr: 2000,
  available: false,
});

export const NAME = "Rakoto Jean";
export const PHONE = "034 12 345 67";
export const NOTE = "Avant 15h.";

interface OpenOptions {
  /** The cart: product id and quantity. One Sakafo by default. */
  readonly lines?: readonly (readonly [string, number])[];
  /** What is stored for the delivery; null when nothing is. A complete draft by default. */
  readonly delivery?: unknown;
  /** The raw content of the contact draft in the session storage. */
  readonly contactDraft?: string;
  readonly api?: Partial<ApiControl>;
}

const COMPLETE_DELIVERY = {
  version: 1,
  point: { lat: -18.912346, lng: 47.512346 },
  landmark: "Portail bleu",
};

function answer(kind: Answer, body: unknown, init: RequestInit | undefined): Promise<Response> {
  if (kind === "pending") {
    return pendingUntilAborted(init);
  }
  return Promise.resolve(kind === "ok" ? jsonResponse(body) : problemResponse(500));
}

/** Stubs the network (the boundary), fills the storages and shows the contact screen. */
export function openContact(options: OpenOptions = {}): {
  readonly control: ApiControl;
  readonly fetchStub: ReturnType<typeof vi.fn>;
} {
  const control: ApiControl = {
    instance: "ok",
    catalogue: "ok",
    instanceData: buildInstance(),
    products: [SAKAFO, MOFO, KOBA],
    ...options.api,
  };
  const fetchStub = vi.fn((input: RequestInfo | URL, init?: RequestInit) =>
    input === "/api/v1/instance"
      ? answer(control.instance, control.instanceData, init)
      : answer(control.catalogue, { products: control.products }, init),
  );
  vi.stubGlobal("fetch", fetchStub);
  sessionStorage.clear();
  localStorage.clear();
  const lines = options.lines ?? [[SAKAFO.id, 1]];
  localStorage.setItem(
    CART_STORAGE_KEY,
    JSON.stringify({
      version: 1,
      lines: lines.map(([productId, quantity]) => ({ productId, quantity })),
    }),
  );
  const delivery = "delivery" in options ? options.delivery : COMPLETE_DELIVERY;
  if (delivery !== null) {
    sessionStorage.setItem(DELIVERY_DRAFT_STORAGE_KEY, JSON.stringify(delivery));
  }
  if (options.contactDraft !== undefined) {
    sessionStorage.setItem(CONTACT_DRAFT_STORAGE_KEY, options.contactDraft);
  }
  renderAt("/coordonnees", createFakeMapLoader());
  return { control, fetchStub };
}

/** Shows the screen again with the storages as they are: a reload. */
export function reopenContact(): void {
  cleanup();
  renderAt("/coordonnees", createFakeMapLoader());
}

export const nameField = (): Promise<HTMLInputElement> =>
  screen.findByRole<HTMLInputElement>("textbox", { name: texts.contact.name.label });
export const phoneField = (): Promise<HTMLInputElement> =>
  screen.findByRole<HTMLInputElement>("textbox", { name: texts.contact.phone.label });
export const noteField = (): Promise<HTMLTextAreaElement> =>
  screen.findByRole<HTMLTextAreaElement>("textbox", {
    name: new RegExp(`^${texts.contact.note.label}`),
  });

/** The summary card of the side column: a region named by its title. */
export const summaryCard = (): Promise<HTMLElement> =>
  screen.findByRole("region", { name: texts.orderSummary.title });

/** The two "Vérifier la commande": the one of the fixed bar, and the one of the side card. */
export async function continueButtons(): Promise<{
  readonly bar: HTMLElement;
  readonly card: HTMLElement;
}> {
  const card = within(await summaryCard()).getByRole("button", { name: texts.contact.continue });
  const all = screen.getAllByRole("button", { name: texts.contact.continue });
  const bar = all.find((button) => button !== card);
  if (bar === undefined || all.length !== 2) {
    throw new Error("The page must hold one button in the bar and one in the card");
  }
  return { bar, card };
}

export const typeInto = (field: HTMLElement, value: string): void => {
  fireEvent.change(field, { target: { value } });
};

/** A valid name and phone number: all that is needed to go on. */
export async function fillValidContact(): Promise<void> {
  typeInto(await nameField(), NAME);
  typeInto(await phoneField(), PHONE);
}
