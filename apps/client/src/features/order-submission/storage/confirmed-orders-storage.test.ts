import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  CONFIRMED_ORDERS_STORAGE_KEY,
  CONFIRMED_ORDER_RETENTION_DAYS,
  addConfirmedOrder,
  readConfirmedOrders,
  removeConfirmedOrder,
  removeExpiredConfirmedOrders,
} from "./confirmed-orders-storage";

const NOW = Date.parse("2026-10-10T12:00:00.000Z");
const DAY = 24 * 60 * 60 * 1000;
const TOKEN = "B".repeat(43);

const order = (code: string, createdAt = "2026-10-10T08:30:00.000Z") => ({
  code,
  token: TOKEN,
  createdAt,
});
const storedOrders = (): unknown[] => {
  const content: unknown = JSON.parse(localStorage.getItem(CONFIRMED_ORDERS_STORAGE_KEY) ?? "null");
  return (content as { orders: unknown[] }).orders;
};

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("the confirmed orders", () => {
  it("keep a code, a token and a date and nothing else, under a versioned key", () => {
    addConfirmedOrder(order("K7M2QX"), NOW);

    expect(CONFIRMED_ORDERS_STORAGE_KEY).toBe("entana.orders.v1");
    expect(JSON.parse(localStorage.getItem(CONFIRMED_ORDERS_STORAGE_KEY) ?? "null")).toEqual({
      version: 1,
      orders: [order("K7M2QX")],
    });
  });

  it("keep the ten most recent, the newest first", () => {
    const codes = ["A", "B", "C", "D", "E", "F", "G", "H", "J", "K", "L"].map(
      (letter) => `AAAAA${letter}`,
    );
    for (const code of codes) {
      addConfirmedOrder(order(code), NOW);
    }

    expect(storedOrders().map((entry) => (entry as { code: string }).code)).toEqual(
      codes.slice(1).reverse(),
    );
  });

  it("drop an order older than the retention", () => {
    const old = new Date(NOW - (CONFIRMED_ORDER_RETENTION_DAYS + 1) * DAY).toISOString();
    addConfirmedOrder(order("ALDANE", old), NOW - DAY);

    removeExpiredConfirmedOrders(NOW);

    expect(storedOrders()).toEqual([]);
  });

  it.each([
    ["text that is not JSON", "{not json"],
    ["another version", JSON.stringify({ version: 2, orders: [order("K7M2QX")] })],
    [
      "an entry with more than the three fields",
      JSON.stringify({
        version: 1,
        orders: [{ ...order("K7M2QX"), phone: "+261341234567" }],
      }),
    ],
    ["an entry with a bad code", JSON.stringify({ version: 1, orders: [order("k7m2qx")] })],
    [
      "a text over the size limit",
      `${JSON.stringify({ version: 1, orders: [] })}${" ".repeat(5000)}`,
    ],
  ])("are replaced by the new one alone when the stored content is %s", (_label, content) => {
    localStorage.setItem(CONFIRMED_ORDERS_STORAGE_KEY, content);

    addConfirmedOrder(order("NEWNEW"), NOW);

    expect(storedOrders()).toEqual([order("NEWNEW")]);
  });

  it("do not fail when the storage is unavailable", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("denied", "SecurityError");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("full", "QuotaExceededError");
    });

    expect(() => {
      addConfirmedOrder(order("K7M2QX"), NOW);
      removeExpiredConfirmedOrders(NOW);
    }).not.toThrow();
  });
});

describe("reading and forgetting a confirmed order", () => {
  it("reads the orders that are not expired, the most recent first", () => {
    addConfirmedOrder(order("AAAAAA", "2026-09-01T08:30:00.000Z"), NOW - 60 * DAY);
    addConfirmedOrder(order("BBBBBB", "2026-10-09T08:30:00.000Z"), NOW);

    expect(readConfirmedOrders(NOW).map((entry) => entry.code)).toEqual(["BBBBBB"]);
  });

  it("moves an order opened again by its link instead of repeating it", () => {
    addConfirmedOrder({ ...order("AAAAAA"), token: "C".repeat(43) }, NOW);
    addConfirmedOrder(order("BBBBBB"), NOW);
    addConfirmedOrder({ ...order("AAAAAA"), token: "C".repeat(43) }, NOW);

    expect(readConfirmedOrders(NOW).map((entry) => entry.code)).toEqual(["AAAAAA", "BBBBBB"]);
  });

  it("forgets one order by its token", () => {
    addConfirmedOrder({ ...order("AAAAAA"), token: "C".repeat(43) }, NOW);
    addConfirmedOrder(order("BBBBBB"), NOW);

    removeConfirmedOrder("C".repeat(43));

    expect(readConfirmedOrders(NOW).map((entry) => entry.code)).toEqual(["BBBBBB"]);
  });
});
