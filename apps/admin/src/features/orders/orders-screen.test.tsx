import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { texts } from "../../i18n/texts";
import { expectNoAccessibilityViolations } from "../../test-support/assertions/expect-no-accessibility-violations";
import { jsonResponse, networkFailure, ROUTES } from "../../test-support/stubs/stub-api";
import { todayInShop } from "../../order-display/format-order";
import {
  answerLists,
  buildOrder,
  listCalls,
  openOrders,
  page,
} from "../../test-support/orders/orders-harness";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const OTHER_STATUSES = "CONFIRMED,OUT_FOR_DELIVERY,DELIVERED,REJECTED,CANCELLED,FAILED";
const nothing = answerLists({ cards: () => page([]), table: () => page([]) });

describe("the tabs", () => {
  it.each([
    ["Toutes", texts.orders.tabs.all, OTHER_STATUSES],
    ["Confirmées", texts.orders.tabs.confirmed, "CONFIRMED"],
    ["En livraison", texts.orders.tabs.outForDelivery, "OUT_FOR_DELIVERY"],
    ["Livrées", texts.orders.tabs.delivered, "DELIVERED"],
    ["Refusées ou annulées", texts.orders.tabs.closed, "REJECTED,CANCELLED,FAILED"],
  ])("asks for the statuses of %s, for the chosen day", async (_label, name, statuses) => {
    const api = await openOrders({ [ROUTES.orders]: nothing });

    fireEvent.click(screen.getByRole("button", { name }));

    await waitFor(() => {
      const last = listCalls(api)
        .filter((call) => call.get("status") !== "NEW")
        .at(-1);
      expect(last?.get("status")).toBe(statuses);
      expect(last?.get("date")).toBe(todayInShop(new Date()));
    });
  });

  it("never sends the day for the orders to process, and asks for no table in À traiter", async () => {
    const api = await openOrders({ [ROUTES.orders]: nothing });
    await waitFor(() => {
      expect(listCalls(api).length).toBeGreaterThan(1);
    });
    const callsBefore = listCalls(api).length;

    fireEvent.click(screen.getByRole("button", { name: new RegExp(texts.orders.tabs.toProcess) }));
    await screen.findByText(texts.orders.allHandled);

    const cardCalls = listCalls(api).filter((call) => call.get("status") === "NEW");
    expect(cardCalls.length).toBeGreaterThan(0);
    expect(cardCalls.every((call) => !call.has("date"))).toBe(true);
    expect(cardCalls.every((call) => call.get("limit") === "3")).toBe(true);
    expect(listCalls(api).length).toBe(callsBefore);
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("marks the tab that is shown, and counts the orders to process", async () => {
    await openOrders({
      [ROUTES.orders]: nothing,
      [ROUTES.summary]: () => jsonResponse({ toProcessCount: 6, todayCount: 10 }),
    });

    await screen.findByText(texts.orders.summary(6, 10));
    const all = screen.getByRole("button", { name: texts.orders.tabs.all });
    const toProcess = screen.getByRole("button", { name: /À traiter/ });

    expect(all.getAttribute("aria-pressed")).toBe("true");
    expect(toProcess.getAttribute("aria-pressed")).toBe("false");
    expect(within(toProcess).getByText("6")).toBeTruthy();
  });
});

describe("the filters row", () => {
  it("puts the zone, the date and the search in a group apart from the status tabs", async () => {
    await openOrders({ [ROUTES.orders]: nothing });

    const filters = screen.getByRole("group", { name: "Filtres" });
    const tabs = screen.getByRole("group", { name: texts.orders.tabsLabel });
    expect(within(filters).getAllByRole("combobox")).toHaveLength(2);
    expect(within(filters).getByRole("searchbox")).toBeTruthy();
    expect(within(tabs).queryByRole("combobox")).toBeNull();
    expect(within(tabs).queryByRole("searchbox")).toBeNull();
    expect(tabs.contains(filters) || filters.contains(tabs)).toBe(false);
  });

  it("names what each filter applies to, and says which ones reach the orders to process", async () => {
    await openOrders({ [ROUTES.orders]: nothing });

    const filters = screen.getByRole("group", {
      name: "Filtres",
      description:
        "L'axe et la date filtrent le tableau. La recherche (2 caractères minimum) filtre aussi les cartes « À traiter ».",
    });
    expect(within(filters).getByRole("combobox", { name: "Zone (axe)" })).toBeTruthy();
    expect(within(filters).getByRole("combobox", { name: "Reçue ou à livrer le" })).toBeTruthy();
    expect(
      within(filters).getByRole("searchbox", { name: "Client (nom ou téléphone)" }),
    ).toHaveProperty("placeholder", "Nom ou téléphone");
  });
});

describe("the search", () => {
  it("sends nothing under 2 characters, then one request per list after the delay", async () => {
    const api = await openOrders({ [ROUTES.orders]: nothing });
    const input = screen.getByRole("searchbox", { name: texts.orders.searchLabel });
    const withQ = (): URLSearchParams[] => listCalls(api).filter((call) => call.has("q"));

    fireEvent.change(input, { target: { value: "R" } });
    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(withQ()).toHaveLength(0);

    fireEvent.change(input, { target: { value: "Ra" } });
    fireEvent.change(input, { target: { value: "Rakoto" } });
    await waitFor(() => {
      expect(withQ()).toHaveLength(2);
    });
    await new Promise((resolve) => setTimeout(resolve, 400));

    expect(withQ().map((call) => call.get("q"))).toEqual(["Rakoto", "Rakoto"]);
    expect(withQ()).toHaveLength(2);
  });
});

describe("the orders to process", () => {
  it("shows the next three and recomputes what is left", async () => {
    const calls: (string | null)[] = [];
    await openOrders({
      [ROUTES.orders]: answerLists({
        cards: (address) => {
          const cursor = address.searchParams.get("cursor");
          calls.push(cursor);
          return cursor === null
            ? page([buildOrder(1), buildOrder(2), buildOrder(3)], 7, "c1")
            : page([buildOrder(4), buildOrder(5), buildOrder(6)], 7, "c2");
        },
        table: () => page([]),
      }),
    });

    await screen.findByText(texts.orders.remaining(4));
    fireEvent.click(screen.getByRole("button", { name: texts.orders.showMore(3) }));

    await screen.findByText(texts.orders.remaining(1));
    expect(screen.getByRole("button", { name: texts.orders.showMore(1) })).toBeTruthy();
    expect(calls).toEqual([null, "c1"]);
    expect(screen.getAllByRole("listitem")).toHaveLength(6);
  });
});

describe("the new orders banner", () => {
  it("appears without moving the list, and the list is reloaded when it is used", async () => {
    let hasNewOrder = false;
    const api = await openOrders({
      [ROUTES.orders]: answerLists({
        cards: () => page([buildOrder(1)], hasNewOrder ? 2 : 1),
        table: () => page([]),
      }),
      [ROUTES.summary]: (_init, address) =>
        jsonResponse({
          toProcessCount: 1,
          todayCount: 1,
          ...(address?.searchParams.has("since") === true
            ? {
                newSince: hasNewOrder
                  ? {
                      count: 1,
                      latest: {
                        id: "0199f5b0-7c1e-7a3b-9d4f-000000000099",
                        publicCode: "ABC999",
                        customerName: "Voahangy",
                      },
                    }
                  : { count: 0, latest: null },
              }
            : {}),
        }),
    });
    await screen.findByText(`#${buildOrder(1).publicCode}`);
    const listCallsBefore = listCalls(api).length;

    hasNewOrder = true;
    window.dispatchEvent(new Event("visibilitychange"));

    const banner = await screen.findByRole("status");
    expect(banner.textContent).toContain("1 nouvelle commande · #ABC999 Voahangy");
    expect(listCalls(api).length).toBe(listCallsBefore);

    fireEvent.click(within(banner).getByRole("button", { name: texts.orders.banner.show }));

    await waitFor(() => {
      expect(listCalls(api).length).toBeGreaterThan(listCallsBefore);
    });
    expect(screen.queryByRole("status")).toBeNull();
  });
});

describe("a row and a card", () => {
  it("writes the day of a confirmed order, the phone number and the amount", async () => {
    await openOrders({
      [ROUTES.orders]: answerLists({
        cards: () => page([buildOrder(1, { isNewCustomer: true })]),
        table: () =>
          page([
            buildOrder(2, {
              status: "CONFIRMED",
              deliveryDate: "2026-10-02",
              totalAr: 7500,
              phone: "+261342245678",
            }),
          ]),
      }),
    });

    await screen.findByText("Confirmée · ven. 2 oct.");
    expect(screen.getByText("034 22 456 78")).toBeTruthy();
    // The default normalizer turns a no-break space into a plain one: the exact text is checked.
    const exact = { normalizer: (text: string): string => text };
    expect(screen.getByText("7\u00a0500\u00a0Ar", exact)).toBeTruthy();
    expect(screen.getByText("8\u00a0500\u00a0Ar", exact)).toBeTruthy();
    expect(screen.getByText("reçue à 10 h 12")).toBeTruthy();
    expect(screen.getByText(texts.orders.isNewCustomer)).toBeTruthy();
    expect(
      screen.getByRole("link", { name: texts.orders.processLabel(buildOrder(1).publicCode) }),
    ).toBeTruthy();
  });

  it("has no accessibility violation", async () => {
    await openOrders({
      [ROUTES.orders]: answerLists({
        cards: () => page([buildOrder(1)]),
        table: () => page([buildOrder(2, { status: "CONFIRMED", deliveryDate: "2026-10-02" })]),
      }),
    });
    await screen.findByRole("table");

    await expectNoAccessibilityViolations(document.body);
  });
});

describe("a load error", () => {
  it("says so with a retry, and shows the list once it works", async () => {
    let isDown = true;
    await openOrders({
      [ROUTES.orders]: (init, address) =>
        isDown
          ? networkFailure()
          : answerLists({ cards: () => page([buildOrder(1)]), table: () => page([]) })(
              init,
              address,
            ),
    });

    const notice = await screen.findByRole("alert");
    expect(notice.textContent).toContain(texts.orders.loadFailed);
    isDown = false;
    fireEvent.click(
      within(notice).getAllByRole("button", { name: texts.common.retry })[0] ?? notice,
    );

    await screen.findByText(`#${buildOrder(1).publicCode}`);
  });
});
