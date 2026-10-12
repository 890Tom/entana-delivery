import { adminOrderListResponseSchema } from "@entana/contracts";
import { describe, expect, it } from "vitest";
import { ORDERS_PATH, useAdminOrdersHarness } from "./support/admin-orders-harness.js";

describe("the filters of the list of orders on a real PostgreSQL", () => {
  const h = useAdminOrdersHarness();

  const listIds = async (query: string): Promise<string[]> => {
    const answer = await h.get(`${ORDERS_PATH}?${query}`);
    expect(answer.status).toBe(200);
    return adminOrderListResponseSchema.parse(answer.body).items.map((item) => item.id);
  };
  const withQ = (q: string): string => `q=${encodeURIComponent(q)}`;
  // A CHECK constraint wants a delivery date on a confirmed order and a reason on a refused one.
  const place = (changes: {
    status?: "CONFIRMED" | "REJECTED" | "CANCELLED";
    createdAt?: string;
    deliveryDate?: string;
  }) => {
    return async (order: { id: string }): Promise<string> => {
      const { status, createdAt, deliveryDate } = changes;
      await h.client.customerOrder.update({
        where: { id: order.id },
        data: {
          ...(status === undefined ? {} : { status }),
          ...(status === "REJECTED" || status === "CANCELLED" ? { statusReason: "reason" } : {}),
          ...(createdAt === undefined ? {} : { createdAt: new Date(createdAt) }),
          ...(status === "CONFIRMED" || deliveryDate !== undefined
            ? { deliveryDate: new Date(deliveryDate ?? "2026-10-09") }
            : {}),
        },
      });
      return order.id;
    };
  };

  describe("status", () => {
    it("keeps the orders of any of the statuses of a comma separated list", async () => {
      const rejected = await place({ status: "REJECTED" })(await h.placeOrder());
      const cancelled = await place({ status: "CANCELLED" })(await h.placeOrder());
      await h.placeOrder();

      const ids = await listIds("status=REJECTED,CANCELLED,REJECTED");

      expect(ids.sort()).toEqual([rejected, cancelled].sort());
    });

    it("answers 400 when one value of the list is unknown", async () => {
      const answer = await h.get(`${ORDERS_PATH}?status=REJECTED,DONE`);

      expect(answer.status).toBe(400);
      expect(answer.text).not.toContain("DONE");
    });
  });

  describe("date", () => {
    it("keeps the orders received that day or to be delivered that day, in the instance time zone", async () => {
      // Indian/Antananarivo is UTC+3: 2026-10-07T21:30Z is 00:30 on the 8th, 20:00Z is 23:00 on the 7th.
      const receivedNoon = await place({ createdAt: "2026-10-08T09:00:00Z" })(await h.placeOrder());
      const receivedJustAfterMidnight = await place({ createdAt: "2026-10-07T21:30:00Z" })(
        await h.placeOrder(),
      );
      const deliveredThatDay = await place({
        status: "CONFIRMED",
        createdAt: "2026-10-01T09:00:00Z",
        deliveryDate: "2026-10-08",
      })(await h.placeOrder());
      await place({ createdAt: "2026-10-07T20:00:00Z" })(await h.placeOrder());
      await place({
        status: "CONFIRMED",
        createdAt: "2026-10-01T09:00:00Z",
        deliveryDate: "2026-10-09",
      })(await h.placeOrder());

      const ids = await listIds("date=2026-10-08");

      expect(ids.sort()).toEqual(
        [receivedNoon, receivedJustAfterMidnight, deliveredThatDay].sort(),
      );
    });

    it("answers 400 for a day that does not exist", async () => {
      const answer = await h.get(`${ORDERS_PATH}?date=2026-02-30`);

      expect(answer.status).toBe(400);
      expect(answer.text).not.toContain("2026-02-30");
    });
  });

  describe("q", () => {
    it("finds a name, whatever the case", async () => {
      const rakoto = await h.placeOrder(1, "034 11 111 11", "Rakoto Jean");
      await h.placeOrder(1, "033 22 222 22", "Rasoa Marie");

      const ids = await listIds(withQ("RAKOTO"));

      expect(ids).toEqual([rakoto.id]);
    });

    it("finds a phone number written in the local format, with its leading zero", async () => {
      const first = await h.placeOrder(1, "034 11 111 11", "Rakoto Jean");
      await h.placeOrder(1, "033 22 222 22", "Rasoa Marie");

      const ids = await listIds(withQ("034 11 111"));

      expect(ids).toEqual([first.id]);
    });

    it("finds a phone number written in E.164", async () => {
      const first = await h.placeOrder(1, "034 11 111 11", "Rakoto Jean");
      await h.placeOrder(1, "033 22 222 22", "Rasoa Marie");

      const ids = await listIds(withQ("+261341111111"));

      expect(ids).toEqual([first.id]);
    });

    it.each([
      ["one character", "Q"],
      ["a letter and a digit", "Rakoto2"],
    ])("answers 400 for %s, without repeating it", async (_label, q) => {
      const answer = await h.get(`${ORDERS_PATH}?${withQ(q)}`);

      expect(answer.status).toBe(400);
      expect(answer.text).not.toContain(q);
    });
  });

  describe("totalCount", () => {
    it("counts every order of the filters, whatever the cursor and the limit", async () => {
      await h.placeOrder(1, "034 11 111 11");
      await h.placeOrder(1, "034 11 111 12");
      await h.placeOrder(1, "034 11 111 13");
      await place({ status: "CONFIRMED" })(await h.placeOrder(1, "034 11 111 14"));

      const first = adminOrderListResponseSchema.parse(
        (await h.get(`${ORDERS_PATH}?status=NEW&limit=1`)).body,
      );
      const second = adminOrderListResponseSchema.parse(
        (await h.get(`${ORDERS_PATH}?status=NEW&limit=1&cursor=${String(first.nextCursor)}`)).body,
      );

      expect([first.items.length, first.totalCount]).toEqual([1, 3]);
      expect([second.items.length, second.totalCount]).toEqual([1, 3]);
    });
  });

  describe("the fields of a row", () => {
    it("shows the name typed for the order and the time it was received", async () => {
      await h.placeOrder(1, "034 11 111 11", "Rakoto Jean");

      const answer = await h.get(ORDERS_PATH);

      expect(answer.body).toMatchObject({
        items: [{ customerName: "Rakoto Jean", createdAt: "2026-10-08T08:00:00.000Z" }],
      });
    });

    it("tells a first order of a customer from the next ones, even when the first is off the page and refused", async () => {
      const first = await h.placeOrder(1, "034 11 111 11", "Rakoto Jean");
      const second = await h.placeOrder(1, "034 11 111 11", "Rakoto Jean");
      const other = await h.placeOrder(1, "033 22 222 22", "Rasoa Marie");
      await place({ status: "REJECTED" })(first);

      const onePage = adminOrderListResponseSchema.parse(
        (await h.get(`${ORDERS_PATH}?status=NEW&limit=2`)).body,
      );
      const isNew = Object.fromEntries(onePage.items.map((i) => [i.id, i.isNewCustomer]));

      expect(isNew).toEqual({ [second.id]: false, [other.id]: true });
    });

    it("tells the first order of a customer", async () => {
      const first = await h.placeOrder(1, "034 11 111 11");

      const answer = adminOrderListResponseSchema.parse((await h.get(ORDERS_PATH)).body);

      expect(answer.items.map((i) => [i.id, i.isNewCustomer])).toEqual([[first.id, true]]);
    });
  });
});
