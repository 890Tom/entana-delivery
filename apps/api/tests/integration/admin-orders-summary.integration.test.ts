import { adminOrderSummaryResponseSchema } from "@entana/contracts";
import { describe, expect, it } from "vitest";
import { ORDERS_PATH, useAdminOrdersHarness } from "./support/admin-orders-harness.js";

const SUMMARY_PATH = `${ORDERS_PATH}/summary`;

describe("the summary of the orders on a real PostgreSQL", () => {
  const h = useAdminOrdersHarness();

  const read = async (
    query = "",
  ): Promise<ReturnType<typeof adminOrderSummaryResponseSchema.parse>> => {
    const answer = await h.get(`${SUMMARY_PATH}${query}`);
    expect(answer.status).toBe(200);
    expect(answer.headers["cache-control"]).toBe("no-store");
    return adminOrderSummaryResponseSchema.parse(answer.body);
  };

  it("is closed without a session", async () => {
    const answer = await h.get(SUMMARY_PATH, null);

    expect(answer.status).toBe(401);
  });

  it("counts the orders to process and the orders received today, in the instance time zone", async () => {
    await h.placeOrder(1, "034 11 111 11");
    const confirmed = await h.placeOrder(1, "034 11 111 12");
    const old = await h.placeOrder(1, "034 11 111 13");
    const beforeMidnight = await h.placeOrder(1, "034 11 111 14");
    const afterMidnight = await h.placeOrder(1, "034 11 111 15");
    await h.client.customerOrder.update({
      where: { id: confirmed.id },
      data: { status: "CONFIRMED", deliveryDate: new Date("2026-10-09") },
    });
    await h.client.customerOrder.update({
      where: { id: old.id },
      data: { createdAt: new Date("2026-10-01T09:00:00Z") },
    });
    await h.client.customerOrder.update({
      where: { id: beforeMidnight.id },
      data: { createdAt: new Date("2026-10-07T20:00:00Z") },
    });
    await h.client.customerOrder.update({
      where: { id: afterMidnight.id },
      data: { createdAt: new Date("2026-10-07T21:30:00Z") },
    });

    const summary = await read();

    // NEW: first, old, beforeMidnight, afterMidnight. Today (the 8th): first, confirmed, afterMidnight.
    expect(summary.toProcessCount).toBe(4);
    expect(summary.todayCount).toBe(3);
  });

  it("has no newSince without since", async () => {
    await h.placeOrder();

    const answer = await h.get(SUMMARY_PATH);

    expect(answer.body).not.toHaveProperty("newSince");
  });

  it("counts the orders to process after since and names the latest", async () => {
    const seen = await h.placeOrder(1, "034 11 111 11", "Rakoto Jean");
    const refused = await h.placeOrder(1, "034 11 111 12", "Rasoa Marie");
    const latest = await h.placeOrder(1, "034 11 111 13", "Randria Paul");
    await h.client.customerOrder.update({
      where: { id: refused.id },
      data: { status: "REJECTED", statusReason: "reason" },
    });

    const summary = await read(`?since=${seen.id}`);

    expect(summary.newSince).toEqual({
      count: 1,
      latest: { id: latest.id, publicCode: latest.code, customerName: "Randria Paul" },
    });
  });

  it("has a null latest when nothing is new since", async () => {
    const seen = await h.placeOrder();

    const summary = await read(`?since=${seen.id}`);

    expect(summary.newSince).toEqual({ count: 0, latest: null });
  });

  it("answers 400 for a since that is not an id", async () => {
    const answer = await h.get(`${SUMMARY_PATH}?since=abc`);

    expect(answer.status).toBe(400);
  });
});
