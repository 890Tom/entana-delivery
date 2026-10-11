import type { OrderStatus, PrismaClient } from "@entana/database";
import type { NestExpressApplication } from "@nestjs/platform-express";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, inject } from "vitest";
import { startOrdersApp } from "../../e2e/support/start-orders-app.js";
import { captureLogs } from "../../e2e/support/log-capture.js";
import type { LogCapture } from "../../e2e/support/log-capture.js";
import { buildTestConfig } from "../../e2e/support/test-config.js";
import { buildOrderRequest, generateTrackingToken } from "../../support/order-request.js";
import { newKey } from "../../support/order-http.js";
import {
  CANCEL_PATH,
  LOOKUP_PATH,
  TRACKING_HEADER,
  TRACKING_PATH,
} from "../../support/tracking-http.js";
import { insertProduct } from "./insert-product.js";
import {
  ManualClock,
  createOrdersService,
  openOrdersClient,
  resetOrderData,
} from "./orders-fixtures.js";

export interface TrackingHarness {
  readonly client: PrismaClient;
  readonly clock: ManualClock;
  readonly logs: LogCapture;
  /** A fresh client address, so that the limit of one test never reaches another. */
  readonly from: () => string;
  readonly read: (token: string, address?: string) => request.Test;
  readonly cancel: (token: string, address?: string) => request.Test;
  /** The lookup by phone number and order code, as a JSON body. */
  readonly lookup: (body: unknown, address?: string) => request.Test;
  /** An order made by the real order service, as a customer would make it. */
  readonly placeOrder: () => Promise<{ token: string; orderCode: string }>;
  /** What the shop's own transition will write (task 6c): the status, its event, its day. */
  readonly moveTo: (orderCode: string, status: OrderStatus, at?: Date) => Promise<void>;
  readonly countCancellationEvents: (orderCode: string) => Promise<number>;
  readonly request: () => ReturnType<typeof request>;
}

const STATUSES_WITH_REASON: readonly OrderStatus[] = ["REJECTED", "CANCELLED", "FAILED"];
const STATUSES_WITHOUT_DAY: readonly OrderStatus[] = ["NEW", "REJECTED", "CANCELLED"];

/** The real application on the throwaway database, started once per describe block. */
export function useTrackingHarness(): TrackingHarness {
  const client = openOrdersClient();
  const logs = captureLogs();
  const clock = new ManualClock();
  let app: NestExpressApplication | undefined;
  let addressCounter = 0;

  const getApp = (): NestExpressApplication => {
    if (app === undefined) {
      throw new Error("The application is not started.");
    }
    return app;
  };
  const from = (): string => {
    addressCounter += 1;
    return `192.0.2.${String(addressCounter % 250)}`;
  };

  beforeAll(async () => {
    app = await startOrdersApp(
      buildTestConfig({
        DATABASE_URL: inject("throwawayConnectionString"),
        TRUST_PROXY: "1",
        LOG_LEVEL: "info",
      }),
      { clock, logs: logs.stream },
    );
  });
  beforeEach(async () => {
    await resetOrderData(client);
    logs.reset();
  });
  afterAll(async () => {
    await getApp().close();
    await resetOrderData(client);
    await client.$disconnect();
  });

  return {
    client,
    clock,
    logs,
    from,
    request: () => request(getApp().getHttpServer()),
    read: (token, address = from()) =>
      request(getApp().getHttpServer())
        .get(TRACKING_PATH)
        .set("X-Forwarded-For", address)
        .set(TRACKING_HEADER, token),
    cancel: (token, address = from()) =>
      request(getApp().getHttpServer())
        .post(CANCEL_PATH)
        .set("X-Forwarded-For", address)
        .set(TRACKING_HEADER, token),
    lookup: (body, address = from()) =>
      request(getApp().getHttpServer())
        .post(LOOKUP_PATH)
        .set("X-Forwarded-For", address)
        .send(body as object),
    placeOrder: async () => {
      const productId = await insertProduct(client, { priceAr: 5000 });
      const token = generateTrackingToken();
      const { response } = await createOrdersService(client, { clock }).createOrder(
        buildOrderRequest([{ productId, quantity: 2 }], { trackingToken: token }),
        newKey(),
      );
      return { token, orderCode: response.orderCode };
    },
    moveTo: async (orderCode, status, at = clock.now()) => {
      const order = await client.customerOrder.findUniqueOrThrow({
        where: { publicCode: orderCode },
        select: { id: true, status: true },
      });
      await client.customerOrder.update({
        where: { id: order.id },
        data: {
          status,
          statusReason: STATUSES_WITH_REASON.includes(status) ? "Out of stock." : null,
          deliveryDate: STATUSES_WITHOUT_DAY.includes(status) ? null : new Date("2026-10-12"),
        },
      });
      await client.orderEvent.create({
        data: {
          orderId: order.id,
          type: "STATUS_CHANGED",
          fromStatus: order.status,
          toStatus: status,
          actorType: "STAFF",
          payload: {},
          createdAt: at,
        },
      });
    },
    countCancellationEvents: (orderCode) =>
      client.orderEvent.count({
        where: { order: { publicCode: orderCode }, toStatus: "CANCELLED" },
      }),
  };
}
