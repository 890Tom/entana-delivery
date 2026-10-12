import { adminOrderDetailSchema, adminOrderListResponseSchema } from "@entana/contracts";
import type { AdminOrderDetail } from "@entana/contracts";
import { describe, expect, it } from "vitest";
import { FAKE_CONTACT_NAME, FAKE_PHONE_E164 } from "../support/order-request.js";
import { ORDERS_PATH, useAdminOrdersHarness } from "./support/admin-orders-harness.js";

const UNKNOWN_ID = "0199f5b0-7c1e-7a3b-9d4f-2b6e8a1c3d5f";
const DEFAULT_REJECTION = "Aucun motif précisé.";
const SHOP_CANCELLATION = "Annulée par la boutique.";
const DELIVERY_FAILED = "Livraison non aboutie.";
// The clock of the harness stands on 2026-10-08, which is also the day in Indian/Antananarivo.
const TODAY = "2026-10-08";
const LAST_ALLOWED_DAY = "2026-12-07";

describe("the administration of orders on a real PostgreSQL", () => {
  const h = useAdminOrdersHarness();
  const transitionsPath = (id: string): string => `${ORDERS_PATH}/${id}/transitions`;

  describe("without a session", () => {
    it("closes the three routes with the same 401", async () => {
      const calls = [
        h.get(ORDERS_PATH, null),
        h.get(`${ORDERS_PATH}/${UNKNOWN_ID}`, null),
        h.post(transitionsPath(UNKNOWN_ID), { to: "DELIVERED" }, null),
      ];

      const answers = await Promise.all(calls);

      expect(answers.map((answer) => answer.status)).toEqual([401, 401, 401]);
    });
  });

  describe("the list", () => {
    it("answers the newest first, 25 at a time, and follows the cursor without a gap or a repeat", async () => {
      const placed = [];
      for (let index = 0; index < 27; index += 1) {
        placed.push(await h.placeOrder(1, `034 98 765 ${String(10 + index)}`));
      }
      const newestFirst = placed.map((order) => order.id).reverse();

      const first = await h.get(ORDERS_PATH);
      const firstPage = adminOrderListResponseSchema.parse(first.body);
      const second = await h.get(`${ORDERS_PATH}?cursor=${String(firstPage.nextCursor)}`);
      const secondPage = adminOrderListResponseSchema.parse(second.body);

      expect(first.status).toBe(200);
      expect(first.headers["cache-control"]).toBe("no-store");
      expect(firstPage.items.map((item) => item.id)).toEqual(newestFirst.slice(0, 25));
      expect(secondPage.items.map((item) => item.id)).toEqual(newestFirst.slice(25));
      expect(secondPage.nextCursor).toBeNull();
    });

    it("shows the columns of a row, with the phone number in E.164 and the item count", async () => {
      const order = await h.placeOrder(3);

      const answer = await h.get(ORDERS_PATH);

      expect(answer.body).toMatchObject({
        items: [
          {
            id: order.id,
            publicCode: order.code,
            status: "NEW",
            deliveryDate: null,
            contactName: FAKE_CONTACT_NAME,
            phone: FAKE_PHONE_E164,
            itemCount: 3,
          },
        ],
      });
    });

    it("keeps only the orders of the status asked for", async () => {
      const confirmed = await h.placeOrder();
      await h.placeOrder();
      await h.setStatus(confirmed.id, "CONFIRMED");

      const answer = await h.get(`${ORDERS_PATH}?status=CONFIRMED`);

      const ids = adminOrderListResponseSchema.parse(answer.body).items.map((item) => item.id);
      expect(ids).toEqual([confirmed.id]);
    });

    it.each([
      ["a limit over 100", "limit=101"],
      ["a status that does not exist", "status=DONE"],
      ["a cursor this API did not issue", "cursor=abc"],
    ])("answers 400 for %s, without repeating the value", async (_label, query) => {
      const answer = await h.get(`${ORDERS_PATH}?${query}`);

      expect(answer.status).toBe(400);
      expect(answer.text).not.toContain(query.split("=")[1] ?? "");
    });
  });

  describe("the detail", () => {
    it("shows the lines, the events and the customer's data, and never the token hash", async () => {
      const order = await h.placeOrder(2);
      const stored = await h.client.customerOrder.findUniqueOrThrow({
        where: { id: order.id },
        select: { publicTokenHash: true },
      });

      const answer = await h.get(`${ORDERS_PATH}/${order.id}`);

      const detail = adminOrderDetailSchema.parse(answer.body);
      expect(answer.status).toBe(200);
      expect(answer.headers["cache-control"]).toBe("no-store");
      expect(detail.lines).toHaveLength(1);
      expect(detail.lines[0]).toMatchObject({ unitPriceAr: 5000, quantity: 2 });
      expect(detail.events).toHaveLength(1);
      expect(detail.events[0]).toMatchObject({
        type: "STATUS_CHANGED",
        toStatus: "NEW",
        actor: { type: "CUSTOMER" },
      });
      expect(answer.text).not.toContain(stored.publicTokenHash);
    });

    it.each([
      ["an id that is not known", UNKNOWN_ID],
      ["an id that is not an id", "not-an-id"],
    ])("answers the same 404 for %s", async (_label, id) => {
      const answer = await h.get(`${ORDERS_PATH}/${id}`);

      expect(answer.status).toBe(404);
      expect(answer.body).toMatchObject({
        status: 404,
        detail: "The requested resource was not found.",
      });
    });
  });

  describe("a status change", () => {
    const allowedMoves = [
      ["NEW", { to: "CONFIRMED", deliveryDate: TODAY }, "CONFIRMED", null],
      ["NEW", { to: "REJECTED", reason: "Out of stock." }, "REJECTED", "Out of stock."],
      ["CONFIRMED", { to: "OUT_FOR_DELIVERY" }, "OUT_FOR_DELIVERY", null],
      ["NEW", { to: "REJECTED" }, "REJECTED", DEFAULT_REJECTION],
      ["CONFIRMED", { to: "CANCELLED" }, "CANCELLED", SHOP_CANCELLATION],
      ["OUT_FOR_DELIVERY", { to: "DELIVERED" }, "DELIVERED", null],
      ["OUT_FOR_DELIVERY", { to: "FAILED" }, "FAILED", DELIVERY_FAILED],
    ] as const;

    it.each(allowedMoves)(
      "moves an order from %s with %j: status, reason, day and event of the admin",
      async (from, body, to, reason) => {
        const order = await h.placeOrder();
        if (from !== "NEW") {
          await h.setStatus(order.id, from);
        }

        const answer = await h.post(transitionsPath(order.id), body);

        expect(answer.status).toBe(200);
        expect(answer.headers["cache-control"]).toBe("no-store");
        const detail: AdminOrderDetail = adminOrderDetailSchema.parse(answer.body);
        expect(detail.status).toBe(to);
        const stored = await h.client.customerOrder.findUniqueOrThrow({
          where: { id: order.id },
          select: { statusReason: true, deliveryDate: true },
        });
        expect(stored.statusReason).toBe(reason);
        if (to === "CONFIRMED") {
          expect(stored.deliveryDate?.toISOString().slice(0, 10)).toBe(TODAY);
          expect(detail.deliveryDate).toBe(TODAY);
        }
        const events = await h.client.orderEvent.findMany({
          where: { orderId: order.id, toStatus: to },
          select: { type: true, fromStatus: true, actorType: true, actorId: true, payload: true },
        });
        const payload =
          reason === null ? (to === "CONFIRMED" ? { deliveryDate: TODAY } : {}) : { reason };
        expect(events).toEqual([
          {
            type: "STATUS_CHANGED",
            fromStatus: from,
            actorType: "STAFF",
            actorId: h.adminId,
            payload,
          },
        ]);
      },
    );

    it.each([
      ["a move that is not in the table", "NEW", { to: "DELIVERED" }],
      ["an order the customer cancelled", "CANCELLED", { to: "CONFIRMED", deliveryDate: TODAY }],
    ] as const)("answers the same 409 and writes nothing for %s", async (_label, from, body) => {
      const order = await h.placeOrder();
      if (from === "CANCELLED") {
        await h.client.customerOrder.update({
          where: { id: order.id },
          data: { status: "CANCELLED", statusReason: "Annulée par le client." },
        });
      }
      const eventsBefore = await h.client.orderEvent.count();

      const answer = await h.post(transitionsPath(order.id), body);

      expect(answer.status).toBe(409);
      expect(answer.body).toMatchObject({
        detail: "The order cannot move to this status.",
      });
      expect(await h.client.orderEvent.count()).toBe(eventsBefore);
    });

    it("lets one of two simultaneous changes win and answers 409 to the other", async () => {
      const order = await h.placeOrder();

      const answers = await Promise.all([
        h.post(transitionsPath(order.id), { to: "CONFIRMED", deliveryDate: TODAY }),
        h.post(transitionsPath(order.id), { to: "REJECTED" }),
      ]);

      expect(answers.map((answer) => answer.status).sort()).toEqual([200, 409]);
      const events = await h.client.orderEvent.count({
        where: { orderId: order.id, actorType: "STAFF" },
      });
      expect(events).toBe(1);
    });

    it.each([
      ["a CONFIRMED without a day", { to: "CONFIRMED" }],
      ["a day in the past", { to: "CONFIRMED", deliveryDate: "2026-10-07" }],
      ["a day more than 60 days ahead", { to: "CONFIRMED", deliveryDate: "2026-12-08" }],
      ["a reason over 300 characters", { to: "REJECTED", reason: "a".repeat(301) }],
      ["a field the move does not take", { to: "DELIVERED", reason: "x" }],
      ["an unknown field", { to: "OUT_FOR_DELIVERY", note: "x" }],
    ])("answers 400 and changes nothing for %s", async (_label, body) => {
      const order = await h.placeOrder();

      const answer = await h.post(transitionsPath(order.id), body);

      expect(answer.status).toBe(400);
      const stored = await h.client.customerOrder.findUniqueOrThrow({
        where: { id: order.id },
        select: { status: true },
      });
      expect(stored.status).toBe("NEW");
    });

    it("accepts today and the last allowed day", async () => {
      const first = await h.placeOrder();
      const second = await h.placeOrder();

      const today = await h.post(transitionsPath(first.id), {
        to: "CONFIRMED",
        deliveryDate: TODAY,
      });
      const last = await h.post(transitionsPath(second.id), {
        to: "CONFIRMED",
        deliveryDate: LAST_ALLOWED_DAY,
      });

      expect([today.status, last.status]).toEqual([200, 200]);
    });

    it("shows the public tracking the new status and the delivery day", async () => {
      const order = await h.placeOrder();

      await h.post(transitionsPath(order.id), { to: "CONFIRMED", deliveryDate: "2026-10-12" });

      const tracking = await h.tracking(order.token);
      expect(tracking.body).toMatchObject({ status: "CONFIRMED", deliveryDate: "2026-10-12" });
    });
  });
});
