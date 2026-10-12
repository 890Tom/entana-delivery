import type { AdminOrderListItem } from "@entana/contracts";
import { render, screen } from "@testing-library/react";

import { App } from "../../app";
import { texts } from "../../i18n/texts";
import { jsonResponse, ROUTES, stubApi } from "../stubs/stub-api";
import type { ApiStub, Handler } from "../stubs/stub-api";

const PROFILE = {
  id: "6f1c2d4e-8a3b-4c5d-9e7f-1a2b3c4d5e6f",
  email: "gerante@example.mg",
  displayName: "Hery Rakoto",
};

export interface Page {
  readonly items: readonly AdminOrderListItem[];
  readonly totalCount: number;
  readonly nextCursor: string | null;
}

const CODE_LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** An order of the list. The index makes its id and its code different from every other. */
export function buildOrder(
  index: number,
  overrides: Partial<AdminOrderListItem> = {},
): AdminOrderListItem {
  return {
    id: `0199f5b0-7c1e-7a3b-9d4f-${String(index).padStart(12, "0")}`,
    publicCode: `${CODE_LETTERS.charAt(index % CODE_LETTERS.length)}BC234`,
    status: "NEW",
    createdAt: "2026-10-08T07:12:00.000Z",
    deliveryDate: null,
    contactName: `Client ${String(index)}`,
    phone: "+261340000000",
    landmarkText: "Près du baobab",
    totalAr: 8500,
    itemCount: 5,
    customerName: `Client ${String(index)}`,
    isNewCustomer: false,
    ...overrides,
  };
}

export const page = (
  items: readonly AdminOrderListItem[],
  totalCount = items.length,
  nextCursor: string | null = null,
): Page => ({ items, totalCount, nextCursor });

/** The list answers by the statuses asked for: the cards ask for NEW only. */
export function answerLists(source: {
  cards: (address: URL) => Page;
  table: (address: URL) => Page;
}): Handler {
  return (_init, address) => {
    const url = address ?? new URL("http://localhost/");
    const isForCards = url.searchParams.get("status") === "NEW";
    return jsonResponse(isForCards ? source.cards(url) : source.table(url));
  };
}

/** The application on the orders screen, signed in, with the API stubbed at the network. */
export async function openOrders(handlers: Parameters<typeof stubApi>[0]): Promise<ApiStub> {
  window.history.replaceState(null, "", "/commandes");
  const api = stubApi({ [ROUTES.me]: () => jsonResponse(PROFILE), ...handlers });
  render(<App />);
  await screen.findByRole("heading", { name: texts.orders.title });
  return api;
}

/** The statuses and the other parameters each call of the list carried, in order. */
export function listCalls(api: ApiStub): readonly URLSearchParams[] {
  return api.addresses(ROUTES.orders).map((address) => address.searchParams);
}
