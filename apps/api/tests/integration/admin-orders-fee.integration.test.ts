import { MAX_AMOUNT_AR, ORDER_PROBLEM_TYPES, adminOrderDetailSchema } from "@entana/contracts";
import { describe, expect, it } from "vitest";
import { ORDERS_PATH, useAdminOrdersHarness } from "./support/admin-orders-harness.js";

// The clock of the harness stands on 2026-10-08, which is also the day in Indian/Antananarivo.
const TODAY = "2026-10-08";
const CONFIRM = { to: "CONFIRMED", deliveryDate: TODAY } as const;

describe("the delivery fee given at confirmation, on a real PostgreSQL", () => {
  const h = useAdminOrdersHarness();
  const transitionsPath = (id: string): string => `${ORDERS_PATH}/${id}/transitions`;

  const readAmounts = (
    orderId: string,
  ): Promise<{ deliveryFee: number; feeReason: string; totalAr: number; status: string }> =>
    h.client.customerOrder.findUniqueOrThrow({
      where: { id: orderId },
      select: { deliveryFee: true, feeReason: true, totalAr: true, status: true },
    });
  const countFeeEvents = (orderId: string): Promise<number> =>
    h.client.orderEvent.count({ where: { orderId, type: "FEE_ADJUSTED" } });

  it("keeps the fee, its reason and the total when no fee is given", async () => {
    const order = await h.placeOrder();
    const before = await readAmounts(order.id);

    const answer = await h.post(transitionsPath(order.id), CONFIRM);

    expect(answer.status).toBe(200);
    expect(await readAmounts(order.id)).toEqual({ ...before, status: "CONFIRMED" });
    expect(await countFeeEvents(order.id)).toBe(0);
  });

  it("sets a different fee, marks it ADJUSTED, computes the total again and records who did it", async () => {
    const order = await h.placeOrder(2);
    const before = await readAmounts(order.id);
    const subtotal = before.totalAr - before.deliveryFee;

    const answer = await h.post(transitionsPath(order.id), { ...CONFIRM, deliveryFeeAr: 1_500 });

    expect(answer.status).toBe(200);
    expect(adminOrderDetailSchema.parse(answer.body)).toMatchObject({
      deliveryFeeAr: 1_500,
      totalAr: subtotal + 1_500,
    });
    expect(await readAmounts(order.id)).toEqual({
      deliveryFee: 1_500,
      feeReason: "ADJUSTED",
      totalAr: subtotal + 1_500,
      status: "CONFIRMED",
    });
    const events = await h.client.orderEvent.findMany({
      where: { orderId: order.id, type: "FEE_ADJUSTED" },
      select: { actorType: true, actorId: true, fromStatus: true, toStatus: true, payload: true },
    });
    expect(events).toEqual([
      {
        actorType: "STAFF",
        actorId: h.adminId,
        fromStatus: null,
        toStatus: null,
        payload: { fromAr: before.deliveryFee, toAr: 1_500 },
      },
    ]);
  });

  it("changes nothing and records no adjustment when the fee given is the recorded one", async () => {
    const order = await h.placeOrder();
    const before = await readAmounts(order.id);

    const answer = await h.post(transitionsPath(order.id), {
      ...CONFIRM,
      deliveryFeeAr: before.deliveryFee,
    });

    expect(answer.status).toBe(200);
    expect(await readAmounts(order.id)).toEqual({ ...before, status: "CONFIRMED" });
    expect(await countFeeEvents(order.id)).toBe(0);
  });

  it.each([
    ["a negative fee", -1],
    ["a fee that is not an integer", 1500.5],
    ["a fee over the limit", 1_000_001],
  ])("answers 400 and changes nothing for %s", async (_label, deliveryFeeAr) => {
    const order = await h.placeOrder();
    const before = await readAmounts(order.id);

    const answer = await h.post(transitionsPath(order.id), { ...CONFIRM, deliveryFeeAr });

    expect(answer.status).toBe(400);
    expect(answer.headers["content-type"]).toContain("application/problem+json");
    expect(await readAmounts(order.id)).toEqual(before);
  });

  it("answers 422 and changes nothing when the new total would not fit the order", async () => {
    const order = await h.placeOrder(1);
    // A line priced so that the order sits 1 000 Ar under the bound of its integer columns.
    await h.client.orderItem.updateMany({
      where: { orderId: order.id },
      data: { unitPrice: MAX_AMOUNT_AR - 1_000 },
    });
    await h.client.customerOrder.update({
      where: { id: order.id },
      data: { deliveryFee: 0, totalAr: MAX_AMOUNT_AR - 1_000 },
    });
    const before = await readAmounts(order.id);

    const answer = await h.post(transitionsPath(order.id), { ...CONFIRM, deliveryFeeAr: 1_001 });

    expect(answer.status).toBe(422);
    expect(answer.headers["content-type"]).toContain("application/problem+json");
    expect(answer.body).toMatchObject({
      type: ORDER_PROBLEM_TYPES.totalTooLarge,
      detail: "The order total is too large.",
    });
    expect(await readAmounts(order.id)).toEqual(before);
    expect(await h.client.orderEvent.count({ where: { orderId: order.id } })).toBe(1);
  });

  it.each([
    ["already confirmed", "CONFIRMED"],
    ["cancelled", "CANCELLED"],
  ] as const)("keeps the 409 and the fee of an order %s", async (_label, status) => {
    const order = await h.placeOrder();
    await h.client.customerOrder.update({
      where: { id: order.id },
      data: {
        status,
        deliveryDate: new Date(TODAY),
        ...(status === "CANCELLED" ? { statusReason: "Annulée par le client." } : {}),
      },
    });
    const before = await readAmounts(order.id);

    const answer = await h.post(transitionsPath(order.id), { ...CONFIRM, deliveryFeeAr: 0 });

    expect(answer.status).toBe(409);
    expect(answer.body).toMatchObject({ detail: "The order cannot move to this status." });
    expect(await readAmounts(order.id)).toEqual(before);
    expect(await countFeeEvents(order.id)).toBe(0);
  });

  it("writes only the fee of the confirmation that wins when two arrive together", async () => {
    const order = await h.placeOrder(2);
    const before = await readAmounts(order.id);
    const subtotal = before.totalAr - before.deliveryFee;

    const answers = await Promise.all([
      h.post(transitionsPath(order.id), { ...CONFIRM, deliveryFeeAr: 1_000 }),
      h.post(transitionsPath(order.id), { ...CONFIRM, deliveryFeeAr: 2_000 }),
    ]);

    expect(answers.map((answer) => answer.status).sort()).toEqual([200, 409]);
    const winner = answers.find((answer) => answer.status === 200);
    const winnerFee = adminOrderDetailSchema.parse(winner?.body).deliveryFeeAr;
    expect(await readAmounts(order.id)).toMatchObject({
      deliveryFee: winnerFee,
      totalAr: subtotal + winnerFee,
    });
    expect(await countFeeEvents(order.id)).toBe(1);
  });

  it("shows the public tracking the adjusted fee and total", async () => {
    const order = await h.placeOrder(2);
    const before = await readAmounts(order.id);
    const subtotal = before.totalAr - before.deliveryFee;

    await h.post(transitionsPath(order.id), { ...CONFIRM, deliveryFeeAr: 700 });

    const tracking = await h.tracking(order.token);
    expect(tracking.body).toMatchObject({ deliveryFeeAr: 700, totalAr: subtotal + 700 });
  });
});
