import { DEFAULT_ADMIN_ORDER_LIMIT } from "@entana/contracts";
import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { texts } from "../../i18n/texts";
import {
  answerLists,
  buildOrder,
  listCalls,
  openOrders,
  page,
} from "../../test-support/orders/orders-harness";
import { buildAxis } from "../../test-support/settings/build-axis";
import { axesList } from "../../test-support/settings/settings-harness";
import { networkFailure, ROUTES } from "../../test-support/stubs/stub-api";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const NORTH = buildAxis(1, { name: "Axe nord" });
const SOUTH = buildAxis(2, { name: "Axe sud", active: false });
const SIZE = DEFAULT_ADMIN_ORDER_LIMIT;
const SECOND_CURSOR = "cursor-page-2";

const row = (index: number) =>
  buildOrder(index, { status: "CONFIRMED", deliveryDate: "2026-10-09" });

/** Two pages of confirmed orders, whatever the zone asked for. */
const twoPages = answerLists({
  cards: () => page([]),
  table: (address) =>
    address.searchParams.get("cursor") === SECOND_CURSOR
      ? page([row(SIZE + 1)], SIZE + 1, null)
      : page(
          Array.from({ length: SIZE }, (_, offset) => row(offset + 1)),
          SIZE + 1,
          SECOND_CURSOR,
        ),
});

const tableCalls = (api: Parameters<typeof listCalls>[0]): URLSearchParams[] =>
  listCalls(api).filter((call) => call.get("status") !== "NEW");

const zoneSelect = (): HTMLSelectElement =>
  screen.getByRole("combobox", { name: texts.orders.zoneLabel });

const optionLabels = (): string[] =>
  within(zoneSelect())
    .getAllByRole("option")
    .map((option) => option.textContent);

describe("the zone of an order in the table", () => {
  it("shows the place and the axis, or outside an axis when the order has no zone", async () => {
    await openOrders({
      [ROUTES.orders]: answerLists({
        cards: () => page([]),
        table: () =>
          page([
            buildOrder(1, {
              status: "CONFIRMED",
              deliveryDate: "2026-10-09",
              deliveryZone: { placeName: "Analakely", axisName: "Axe nord" },
            }),
            buildOrder(2, { status: "CONFIRMED", deliveryDate: "2026-10-09" }),
          ]),
      }),
    });

    const table = await screen.findByRole("table");
    expect(
      within(table).getByRole("columnheader", { name: texts.orders.columns.zone }),
    ).toBeTruthy();
    const [, inAxis, outside] = within(table).getAllByRole("row");
    expect(inAxis?.textContent).toContain("Analakely");
    expect(inAxis?.textContent).toContain("Axe nord");
    expect(outside?.textContent).toContain(texts.orders.outsideAxis);
  });
});

describe("the zone filter", () => {
  it("offers every zone, each axis with the inactive one marked, then outside an axis", async () => {
    await openOrders({ [ROUTES.axes]: () => axesList(NORTH, SOUTH) });

    await waitFor(() => {
      expect(optionLabels()).toEqual([
        texts.orders.allZones,
        "Axe nord",
        texts.orders.inactiveAxis("Axe sud"),
        texts.orders.outsideAxis,
      ]);
    });
  });

  it("sends the axis, then none, then nothing, each time from the first page", async () => {
    const api = await openOrders({
      [ROUTES.orders]: twoPages,
      [ROUTES.axes]: () => axesList(NORTH, SOUTH),
    });
    await screen.findByText(texts.orders.pagination.page(1, 2));
    fireEvent.click(screen.getByRole("button", { name: texts.orders.pagination.next }));
    await screen.findByText(`Client ${String(SIZE + 1)}`);
    await screen.findByRole("option", { name: "Axe nord" });

    for (const [value, expected] of [
      [NORTH.id, NORTH.id],
      ["none", "none"],
      ["", null],
    ] as const) {
      fireEvent.change(zoneSelect(), { target: { value } });
      await waitFor(() => {
        const last = tableCalls(api).at(-1);
        expect(last?.get("zone")).toBe(expected);
        expect(last?.get("cursor")).toBeNull();
      });
    }
    await screen.findByText(texts.orders.pagination.page(1, 2));
    expect(
      listCalls(api)
        .filter((call) => call.get("status") === "NEW")
        .every((call) => !call.has("zone")),
    ).toBe(true);
  });

  it("stays usable with every zone and outside an axis when the axes cannot be read", async () => {
    await openOrders({ [ROUTES.axes]: () => networkFailure() });

    await waitFor(() => {
      expect(optionLabels()).toEqual([texts.orders.allZones, texts.orders.outsideAxis]);
    });
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
