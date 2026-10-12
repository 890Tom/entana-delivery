import { DEFAULT_ADMIN_ORDER_LIMIT } from "@entana/contracts";
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { texts } from "../../../i18n/texts";
import {
  answerLists,
  buildOrder,
  listCalls,
  openOrders,
  page,
} from "../../../test-support/orders/orders-harness";
import { ROUTES } from "../../../test-support/stubs/stub-api";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const p = texts.orders.pagination;
const SIZE = DEFAULT_ADMIN_ORDER_LIMIT;
const TOTAL = SIZE + 5;
const row = (index: number) =>
  buildOrder(index, { status: "CONFIRMED", deliveryDate: "2026-10-09" });
const range = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, offset) => row(from + offset));

const SECOND_CURSOR = "cursor-page-2";

/** 30 orders: a first page of 25 and a second of 5, found by the cursor. */
const twoPages = answerLists({
  cards: () => page([]),
  table: (address) =>
    address.searchParams.get("cursor") === SECOND_CURSOR
      ? page(range(SIZE + 1, TOTAL), TOTAL, null)
      : page(range(1, SIZE), TOTAL, SECOND_CURSOR),
});

const tableCalls = (api: Parameters<typeof listCalls>[0]): URLSearchParams[] =>
  listCalls(api).filter((call) => call.get("status") !== "NEW");

describe("the pages of the table", () => {
  it("shows the first page only, with its place among the pages", async () => {
    await openOrders({ [ROUTES.orders]: twoPages });

    await screen.findByText(p.page(1, 2));

    expect(screen.getByText("Client 1")).toBeTruthy();
    expect(screen.getByText(`Client ${String(SIZE)}`)).toBeTruthy();
    expect(screen.queryByText(`Client ${String(SIZE + 1)}`)).toBeNull();
    expect(screen.getByRole("button", { name: p.previous }).getAttribute("aria-disabled")).toBe(
      "true",
    );
    expect(screen.getByRole("button", { name: p.next }).getAttribute("aria-disabled")).toBeNull();
  });

  it("goes to the next page with its cursor, and shows that page alone", async () => {
    const api = await openOrders({ [ROUTES.orders]: twoPages });
    await screen.findByText(p.page(1, 2));

    fireEvent.click(screen.getByRole("button", { name: p.next }));

    await screen.findByText(`Client ${String(SIZE + 1)}`);
    expect(screen.getByText(p.page(2, 2))).toBeTruthy();
    expect(screen.queryByText("Client 1")).toBeNull();
    expect(tableCalls(api).at(-1)?.get("cursor")).toBe(SECOND_CURSOR);
    expect(screen.getByRole("button", { name: p.next }).getAttribute("aria-disabled")).toBe("true");
  });

  it("goes back to the previous page", async () => {
    await openOrders({ [ROUTES.orders]: twoPages });
    await screen.findByText(p.page(1, 2));
    fireEvent.click(screen.getByRole("button", { name: p.next }));
    await screen.findByText(`Client ${String(SIZE + 1)}`);

    fireEvent.click(screen.getByRole("button", { name: p.previous }));

    await screen.findByText(p.page(1, 2));
    expect(screen.getByText("Client 1")).toBeTruthy();
  });

  it("starts again from the first page when the view changes", async () => {
    const api = await openOrders({ [ROUTES.orders]: twoPages });
    await screen.findByText(p.page(1, 2));
    fireEvent.click(screen.getByRole("button", { name: p.next }));
    await screen.findByText(`Client ${String(SIZE + 1)}`);

    fireEvent.click(screen.getByRole("button", { name: texts.orders.tabs.confirmed }));

    await screen.findByText(p.page(1, 2));
    await waitFor(() => {
      expect(tableCalls(api).at(-1)?.get("cursor")).toBeNull();
    });
  });

  it("has no pagination when everything fits in one page", async () => {
    await openOrders({
      [ROUTES.orders]: answerLists({ cards: () => page([]), table: () => page(range(1, 3)) }),
    });

    await screen.findByText("Client 1");

    expect(screen.queryByRole("button", { name: p.next })).toBeNull();
    expect(screen.queryByText(p.page(1, 1))).toBeNull();
  });
});
