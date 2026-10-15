import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { texts } from "../../../i18n/texts";
import {
  jsonResponse,
  problemResponse,
  ROUTES,
  transitionRoute,
} from "../../../test-support/stubs/stub-api";
import type { Handler } from "../../../test-support/stubs/stub-api";
import {
  answerLists,
  buildOrder,
  listCalls,
  openOrders,
  page,
} from "../../../test-support/orders/orders-harness";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const confirmed = [1, 2, 3].map((index) =>
  buildOrder(index, { status: "CONFIRMED", deliveryDate: "2026-10-09" }),
);
const first = buildOrder(1, { status: "CONFIRMED", deliveryDate: "2026-10-09" });
const onTheRoad = buildOrder(4, { status: "OUT_FOR_DELIVERY" });
const delivered = buildOrder(5, { status: "DELIVERED" });
const region = { name: texts.orders.selection.region };
const startDelivery = (count: number): string => texts.orders.selection.startDelivery(count);

/** The body a call sent, read back as the JSON it is. */
function sentBody(init: RequestInit | undefined): unknown {
  return typeof init?.body === "string" ? (JSON.parse(init.body) as unknown) : null;
}

/** A transition answer the screen accepts: the detail is validated, so it is a whole order. */
function detailOf(order: { id: string }, status: "OUT_FOR_DELIVERY" | "DELIVERED"): Response {
  const row = buildOrder(0, { id: order.id, status });
  return jsonResponse({
    id: row.id,
    publicCode: row.publicCode,
    status,
    createdAt: row.createdAt,
    deliveryDate: row.deliveryDate,
    contactName: row.contactName,
    phone: row.phone,
    landmarkText: row.landmarkText,
    totalAr: row.totalAr,
    itemCount: row.itemCount,
    deliveryZone: null,
    lines: [{ productName: "Vanille", unitPriceAr: 1000, quantity: 1 }],
    deliveryFeeAr: 0,
    customerNote: null,
    latitude: -18.9,
    longitude: 47.5,
    rejectionReason: null,
    events: [],
  });
}

const advanceName = (code: string): string => texts.orders.actions.outForDeliveryLabel(code);

describe("the action of a row", () => {
  it("sends the next transition, and shows the order in its new status", async () => {
    let status: "CONFIRMED" | "OUT_FOR_DELIVERY" = "CONFIRMED";
    const api = await openOrders({
      [ROUTES.orders]: answerLists({
        cards: () => page([]),
        table: () => page([{ ...first, status }]),
      }),
      [transitionRoute(first.id)]: () => {
        status = "OUT_FOR_DELIVERY";
        return detailOf(first, status);
      },
    });

    fireEvent.click(await screen.findByRole("button", { name: advanceName(first.publicCode) }));

    await screen.findByRole("button", {
      name: texts.orders.actions.deliveredLabel(first.publicCode),
    });
    const sent = api.calls(transitionRoute(first.id));
    expect(sent).toHaveLength(1);
    expect(sentBody(sent[0])).toEqual({ to: "OUT_FOR_DELIVERY" });
  });

  it("says the status changed, and reloads, when the order moved in between", async () => {
    const api = await openOrders({
      [ROUTES.orders]: answerLists({ cards: () => page([]), table: () => page([first]) }),
      [transitionRoute(first.id)]: () => problemResponse(409),
    });
    const before = listCalls(api).length;

    fireEvent.click(await screen.findByRole("button", { name: advanceName(first.publicCode) }));

    await screen.findByText(texts.orders.conflict);
    await waitFor(() => {
      expect(listCalls(api).length).toBeGreaterThan(before);
    });
  });

  it("disables the button of this row only while it is sent", async () => {
    const second = buildOrder(2, { status: "CONFIRMED", deliveryDate: "2026-10-09" });
    let release: () => void = () => undefined;
    const pending: Handler = () =>
      new Promise((resolve) => {
        release = () => {
          resolve(problemResponse(500));
        };
      });
    await openOrders({
      [ROUTES.orders]: answerLists({ cards: () => page([]), table: () => page([first, second]) }),
      [transitionRoute(first.id)]: pending,
    });
    const firstButton = await screen.findByRole("button", { name: advanceName(first.publicCode) });
    const secondButton = screen.getByRole("button", { name: advanceName(second.publicCode) });

    fireEvent.click(firstButton);

    await waitFor(() => {
      expect(firstButton.getAttribute("aria-disabled")).toBe("true");
    });
    expect(secondButton.getAttribute("aria-disabled")).toBeNull();
    release();
    await waitFor(() => {
      expect(firstButton.getAttribute("aria-disabled")).toBeNull();
    });
  });
});

describe("the selection", () => {
  it("allows one status at a time, and not the select all outside a status tab", async () => {
    await openOrders({
      [ROUTES.orders]: answerLists({
        cards: () => page([]),
        table: () => page([first, onTheRoad, delivered]),
      }),
    });
    const rows = await screen.findAllByRole("checkbox");
    const header = screen.getByRole("checkbox", { name: texts.orders.columns.selectAll });
    const disabled = rows.slice(1).map((box) => box.hasAttribute("disabled"));
    expect([header.hasAttribute("disabled"), ...disabled]).toEqual([true, false, false, true]);

    fireEvent.click(screen.getByRole("checkbox", { name: new RegExp(first.publicCode) }));

    const road = screen.getByRole("checkbox", { name: new RegExp(onTheRoad.publicCode) });
    expect(road.hasAttribute("disabled")).toBe(true);
    expect(screen.getByRole("region", region)).toBeTruthy();
    expect(screen.getByText("1 commande sélectionnée")).toBeTruthy();
  });

  it("is cleared when the tab changes", async () => {
    await openOrders({
      [ROUTES.orders]: answerLists({ cards: () => page([]), table: () => page(confirmed) }),
    });
    fireEvent.click(await screen.findByRole("checkbox", { name: new RegExp(first.publicCode) }));
    await screen.findByRole("region", region);

    fireEvent.click(screen.getByRole("button", { name: texts.orders.tabs.confirmed }));

    await waitFor(() => {
      expect(screen.queryByRole("region", region)).toBeNull();
    });
  });
});

describe("the action on a selection", () => {
  it("sends one transition per order, in the order of the table, then reloads", async () => {
    const sent: string[] = [];
    const handlers = Object.fromEntries(
      confirmed.map((order) => [
        transitionRoute(order.id),
        (init: RequestInit | undefined): Response => {
          sent.push(`${order.id}:${JSON.stringify(sentBody(init))}`);
          return detailOf(order, "OUT_FOR_DELIVERY");
        },
      ]),
    );
    const api = await openOrders({
      [ROUTES.orders]: answerLists({ cards: () => page([]), table: () => page(confirmed) }),
      ...handlers,
    });
    fireEvent.click(screen.getByRole("button", { name: texts.orders.tabs.confirmed }));
    fireEvent.click(await screen.findByRole("checkbox", { name: texts.orders.columns.selectAll }));
    const before = listCalls(api).length;

    fireEvent.click(screen.getByRole("button", { name: startDelivery(3) }));

    await waitFor(() => {
      expect(screen.queryByRole("region", region)).toBeNull();
    });
    expect(sent).toEqual(confirmed.map((o) => `${o.id}:{"to":"OUT_FOR_DELIVERY"}`));
    await waitFor(() => {
      expect(listCalls(api).length).toBeGreaterThan(before);
    });
    expect(screen.queryByText(/pas pu l'être/)).toBeNull();
  });

  it("moves the others and counts the one that could not be, when one order changed", async () => {
    const handlers = Object.fromEntries(
      confirmed.map((order, index) => [
        transitionRoute(order.id),
        (): Response => (index === 1 ? problemResponse(409) : detailOf(order, "OUT_FOR_DELIVERY")),
      ]),
    );
    await openOrders({
      [ROUTES.orders]: answerLists({ cards: () => page([]), table: () => page(confirmed) }),
      ...handlers,
    });
    fireEvent.click(screen.getByRole("button", { name: texts.orders.tabs.confirmed }));
    fireEvent.click(await screen.findByRole("checkbox", { name: texts.orders.columns.selectAll }));

    fireEvent.click(screen.getByRole("button", { name: startDelivery(3) }));

    const notice = await screen.findByText(/pas pu l'être/);
    expect(notice.textContent).toBe(
      "2 commandes mises à jour, 1 n'a pas pu l'être (statut modifié ou erreur).",
    );
    expect(screen.queryByRole("region", region)).toBeNull();
  });
});
