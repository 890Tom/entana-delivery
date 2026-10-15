import type { AdminOrderDetail } from "@entana/contracts";
import { render, screen } from "@testing-library/react";

import { App } from "../../app";
import { texts } from "../../i18n/texts";
import { jsonResponse, ROUTES, stubApi } from "../stubs/stub-api";
import type { ApiStub } from "../stubs/stub-api";

const PROFILE = {
  id: "6f1c2d4e-8a3b-4c5d-9e7f-1a2b3c4d5e6f",
  email: "gerante@example.mg",
  displayName: "Hery Rakoto",
};

export const ORDER_ID = "0199f5b0-7c1e-7a3b-9d4f-000000000001";
export const ORDER_CODE = "ABC234";

/** The instant the tests read as "now": 12:00 in the shop, Thursday 1 October 2026. */
export const NOW = new Date("2026-10-01T09:00:00.000Z");

/** An order of the detail, new, with one line of two articles (2 000 Ar) and a fee of 2 500 Ar. */
export function buildDetail(overrides: Partial<AdminOrderDetail> = {}): AdminOrderDetail {
  return {
    id: ORDER_ID,
    publicCode: ORDER_CODE,
    status: "NEW",
    createdAt: "2026-10-01T06:47:00.000Z",
    deliveryDate: null,
    contactName: "Rasoa",
    phone: "+261331234567",
    landmarkText: "Maison jaune, en face de l'épicerie",
    totalAr: 4500,
    itemCount: 2,
    deliveryZone: null,
    lines: [{ productName: "Vanille", unitPriceAr: 1000, quantity: 2 }],
    deliveryFeeAr: 2500,
    customerNote: null,
    latitude: -18.9,
    longitude: 47.5,
    rejectionReason: null,
    events: [
      {
        type: "STATUS_CHANGED",
        fromStatus: null,
        toStatus: "NEW",
        createdAt: "2026-10-01T06:47:00.000Z",
        actor: { type: "CUSTOMER", id: null },
      },
    ],
    ...overrides,
  };
}

/** The application on the address of an order, signed in, with the API stubbed at the network. */
export function openOrderPage(
  handlers: Parameters<typeof stubApi>[0],
  orderId: string = ORDER_ID,
): ApiStub {
  window.history.replaceState(null, "", `/commandes/${orderId}`);
  const api = stubApi({ [ROUTES.me]: () => jsonResponse(PROFILE), ...handlers });
  render(<App />);
  return api;
}

/** The same, once the sheet of the order is on screen. */
export async function openOrderDetail(handlers: Parameters<typeof stubApi>[0]): Promise<ApiStub> {
  const api = openOrderPage(handlers);
  await screen.findByRole("heading", { name: texts.orderDetail.title(ORDER_CODE), level: 1 });
  return api;
}

/** The body a call sent, read back as the JSON it is. */
export function sentBody(init: RequestInit | undefined): unknown {
  return typeof init?.body === "string" ? (JSON.parse(init.body) as unknown) : null;
}
