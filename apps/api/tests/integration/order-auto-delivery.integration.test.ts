import type { OrderStatus } from "@entana/contracts";
import type { PrismaClient } from "@entana/database";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { OrderAutoDeliveryService } from "../../src/order-auto-delivery/order-auto-delivery.service.js";
import { newKey } from "../support/order-http.js";
import { buildOrderRequest, generateTrackingToken } from "../support/order-request.js";
import { insertProduct } from "./support/insert-product.js";
import {
  ManualClock,
  createOrdersService,
  openOrdersClient,
  resetOrderData,
} from "./support/orders-fixtures.js";

// 04:00 in Indian/Antananarivo (UTC+3) on 2026-10-08: the hour the job runs.
const RUN_AT = new Date("2026-10-08T01:00:00.000Z");
const TODAY = "2026-10-08";
const YESTERDAY = "2026-10-07";
const LONG_AGO = "2026-09-01";
const INSTANCE = { timezone: "Indian/Antananarivo" };

describe("the automatic delivery of overdue orders on a real PostgreSQL", () => {
  const client: PrismaClient = openOrdersClient();
  const clock = new ManualClock(RUN_AT);
  const service = new OrderAutoDeliveryService(client, clock, INSTANCE);
  let phoneCounter = 0;

  beforeEach(async () => {
    await resetOrderData(client);
  });
  afterAll(async () => {
    await resetOrderData(client);
    await client.$disconnect();
  });

  async function placeOrder(status: OrderStatus, deliveryDate: string): Promise<string> {
    phoneCounter += 1;
    const productId = await insertProduct(client, { priceAr: 5000 });
    const { response } = await createOrdersService(client, { clock }).createOrder(
      buildOrderRequest([{ productId, quantity: 1 }], {
        trackingToken: generateTrackingToken(),
        phone: `034 98 765 ${String(10 + phoneCounter)}`,
      }),
      newKey(),
    );
    const { id } = await client.customerOrder.update({
      where: { publicCode: response.orderCode },
      data: {
        status,
        deliveryDate: new Date(deliveryDate),
        ...(status === "CANCELLED" ? { statusReason: "Fake cancellation reason." } : {}),
      },
      select: { id: true },
    });
    return id;
  }

  async function readStatus(orderId: string): Promise<OrderStatus> {
    const { status } = await client.customerOrder.findUniqueOrThrow({
      where: { id: orderId },
      select: { status: true },
    });
    return status;
  }

  // The events written after the order's creation: its NEW event is the customer's.
  async function readSystemMoves(orderId: string): Promise<string[]> {
    const events = await client.orderEvent.findMany({
      where: { orderId, actorType: "SYSTEM" },
      orderBy: { id: "asc" },
      select: { type: true, fromStatus: true, toStatus: true, actorId: true, createdAt: true },
    });
    return events.map(
      (event) =>
        `${event.type} ${String(event.fromStatus)}>${String(event.toStatus)} ` +
        `${String(event.actorId)} ${event.createdAt.toISOString()}`,
    );
  }

  it("delivers an order out for delivery whose day was yesterday, with one event", async () => {
    const orderId = await placeOrder("OUT_FOR_DELIVERY", YESTERDAY);

    await service.deliverOverdueOrders();

    expect(await readStatus(orderId)).toBe("DELIVERED");
    expect(await readSystemMoves(orderId)).toEqual([
      `STATUS_CHANGED OUT_FOR_DELIVERY>DELIVERED null ${RUN_AT.toISOString()}`,
    ]);
  });

  it("delivers a confirmed order whose day was yesterday through both steps, with two events", async () => {
    const orderId = await placeOrder("CONFIRMED", YESTERDAY);

    await service.deliverOverdueOrders();

    expect(await readStatus(orderId)).toBe("DELIVERED");
    expect(await readSystemMoves(orderId)).toEqual([
      `STATUS_CHANGED CONFIRMED>OUT_FOR_DELIVERY null ${RUN_AT.toISOString()}`,
      `STATUS_CHANGED OUT_FOR_DELIVERY>DELIVERED null ${RUN_AT.toISOString()}`,
    ]);
  });

  it("leaves a confirmed or out-for-delivery order planned for today unchanged", async () => {
    const confirmed = await placeOrder("CONFIRMED", TODAY);
    const outForDelivery = await placeOrder("OUT_FOR_DELIVERY", TODAY);

    await service.deliverOverdueOrders();

    expect([await readStatus(confirmed), await readStatus(outForDelivery)]).toEqual([
      "CONFIRMED",
      "OUT_FOR_DELIVERY",
    ]);
    expect(await client.orderEvent.count({ where: { actorType: "SYSTEM" } })).toBe(0);
  });

  it("never touches a new or a cancelled order, however old", async () => {
    const pending = await placeOrder("NEW", LONG_AGO);
    const cancelled = await placeOrder("CANCELLED", LONG_AGO);

    await service.deliverOverdueOrders();

    expect([await readStatus(pending), await readStatus(cancelled)]).toEqual(["NEW", "CANCELLED"]);
    expect(await client.orderEvent.count({ where: { actorType: "SYSTEM" } })).toBe(0);
  });

  it("changes nothing on a second run in a row", async () => {
    await placeOrder("CONFIRMED", YESTERDAY);
    await service.deliverOverdueOrders();
    const eventsAfterFirstRun = await client.orderEvent.count();

    const deliveredCount = await service.deliverOverdueOrders();

    expect(deliveredCount).toBe(0);
    expect(await client.orderEvent.count()).toBe(eventsAfterFirstRun);
  });

  it("at 04:00 in Antananarivo, still the previous day in UTC, closes yesterday's order and not today's", async () => {
    const yesterdays = await placeOrder("OUT_FOR_DELIVERY", YESTERDAY);
    const todays = await placeOrder("OUT_FOR_DELIVERY", TODAY);

    const deliveredCount = await service.deliverOverdueOrders();

    expect(deliveredCount).toBe(1);
    expect([await readStatus(yesterdays), await readStatus(todays)]).toEqual([
      "DELIVERED",
      "OUT_FOR_DELIVERY",
    ]);
  });
});
