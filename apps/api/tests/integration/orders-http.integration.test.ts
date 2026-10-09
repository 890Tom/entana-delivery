import { createOrderResponseSchema, problemDetailsSchema } from "@entana/contracts";
import type { CreateOrderRequest } from "@entana/contracts";
import type { PrismaClient } from "@entana/database";
import type { NestExpressApplication } from "@nestjs/platform-express";
import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, inject, it } from "vitest";
import { hashTrackingToken } from "../../src/orders/rules/hash-tracking-token.js";
import { startOrdersApp } from "../e2e/support/start-orders-app.js";
import { captureLogs } from "../e2e/support/log-capture.js";
import { buildTestConfig } from "../e2e/support/test-config.js";
import {
  FAKE_PHONE_E164,
  buildOrderRequest,
  generateTrackingToken,
} from "../support/order-request.js";
import { FIXED_429, ORDERS_PATH, newKey } from "../support/order-http.js";
import { countRows, findChangedTables } from "./support/count-rows.js";
import { insertProduct } from "./support/insert-product.js";
import {
  ManualClock,
  countCellsContaining,
  openOrdersClient,
  resetOrderData,
} from "./support/orders-fixtures.js";

describe("POST /api/v1/orders on a real PostgreSQL", () => {
  const client: PrismaClient = openOrdersClient();
  const logs = captureLogs();
  const clock = new ManualClock();
  let app: NestExpressApplication;
  let addressCounter = 0;

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
  afterEach(() => {
    clock.advanceMinutes(11);
  });
  afterAll(async () => {
    await app.close();
    await resetOrderData(client);
    await client.$disconnect();
  });

  function post(body: unknown, key: string = newKey(), address?: string): request.Test {
    addressCounter += 1;
    return request(app.getHttpServer())
      .post(ORDERS_PATH)
      .set("X-Forwarded-For", address ?? `192.0.2.${String(addressCounter % 250)}`)
      .set("Idempotency-Key", key)
      .set("Content-Type", "application/json")
      .send(JSON.stringify(body));
  }

  async function oneProduct(overrides: Parameters<typeof insertProduct>[1] = {}): Promise<string> {
    return insertProduct(client, { priceAr: 5000, ...overrides });
  }

  function orderFor(
    productId: string,
    overrides: Partial<CreateOrderRequest> = {},
  ): CreateOrderRequest {
    return buildOrderRequest([{ productId, quantity: 2 }], overrides);
  }

  describe("creation", () => {
    it("creates the order, its items and its creation event, and answers with the schema", async () => {
      const productId = await oneProduct();
      const token = generateTrackingToken();

      const response = await post(orderFor(productId, { trackingToken: token }));

      expect(response.status).toBe(201);
      const body = createOrderResponseSchema.parse(response.body);
      expect(body.totalAr).toBe(10000);
      expect(response.headers["cache-control"]).toBe("no-store");
      expect(response.headers["idempotent-replayed"]).toBeUndefined();
      const orders = await client.customerOrder.findMany({ include: { items: true } });
      expect(orders).toHaveLength(1);
      expect(orders[0]?.publicCode).toBe(body.orderCode);
      expect(orders[0]?.items).toHaveLength(1);
      expect(await client.orderEvent.count({ where: { orderId: orders[0]?.id } })).toBe(1);
    });

    it("stores the hash of the tracking token, and the token itself in no column", async () => {
      const productId = await oneProduct();
      const token = generateTrackingToken();

      await post(orderFor(productId, { trackingToken: token }));

      const order = await client.customerOrder.findFirstOrThrow();
      expect(order.publicTokenHash).toBe(hashTrackingToken(token));
      expect(order.publicTokenHash).not.toBe(token);
      expect(await countCellsContaining(client, token)).toBe(0);
    });
  });

  describe("replay and conflicts", () => {
    it("replays the same key and body: 201, the same body, the header, and no new row", async () => {
      const body = orderFor(await oneProduct());
      const key = newKey();
      const first = await post(body, key);
      const before = await countRows(client);

      const replay = await post(body, key);

      expect(replay.status).toBe(201);
      expect(replay.headers["idempotent-replayed"]).toBe("true");
      expect(replay.body).toEqual(first.body);
      expect(findChangedTables(before, await countRows(client))).toEqual([]);
    });

    it("replays the same key written in upper case: 201, the replay header, no new row", async () => {
      const body = orderFor(await oneProduct());
      const key = newKey();
      expect(key).not.toBe(key.toUpperCase());
      const first = await post(body, key.toLowerCase());
      expect(first.status).toBe(201);
      const before = await countRows(client);

      const replay = await post(body, key.toUpperCase());

      expect(replay.status).toBe(201);
      expect(replay.headers["idempotent-replayed"]).toBe("true");
      expect(replay.body).toEqual(first.body);
      expect(findChangedTables(before, await countRows(client))).toEqual([]);
    });

    it("stores the key in lower case", async () => {
      const key = newKey();

      await post(orderFor(await oneProduct()), key.toUpperCase());

      const order = await client.customerOrder.findFirstOrThrow();
      expect(order.idempotencyKey).toBe(key.toLowerCase());
    });

    it("detects a conflict whatever the case of the key", async () => {
      const productId = await oneProduct();
      const key = newKey();
      await post(orderFor(productId), key.toLowerCase());

      const response = await post(
        orderFor(productId, { contactName: "Someone Else" }),
        key.toUpperCase(),
      );

      expect(response.status).toBe(409);
      expect(await client.customerOrder.count()).toBe(1);
    });

    it("creates one order for two simultaneous requests with the two spellings of a key", async () => {
      const body = orderFor(await oneProduct());
      const key = newKey();

      const responses = await Promise.all([
        post(body, key.toLowerCase()),
        post(body, key.toUpperCase()),
        post(body, key.toLowerCase()),
        post(body, key.toUpperCase()),
      ]);

      expect(responses.map((response) => response.status)).toEqual([201, 201, 201, 201]);
      const replays = responses.filter(
        (response) => response.headers["idempotent-replayed"] === "true",
      );
      expect(replays).toHaveLength(3);
      expect(await client.customerOrder.count()).toBe(1);
    });

    it("answers 409 for the same key with another body", async () => {
      const productId = await oneProduct();
      const key = newKey();
      await post(orderFor(productId), key);

      const response = await post(orderFor(productId, { contactName: "Someone Else" }), key);

      expect(response.status).toBe(409);
    });

    it("answers the same 409 body for the same key with another phone, and creates one order only", async () => {
      const productId = await oneProduct();
      const key = newKey();
      const original = orderFor(productId);
      await post(original, key);
      const otherBody = await post({ ...original, contactName: "Someone Else" }, key);

      const otherPhone = await post({ ...original, phone: "032 11 222 33" }, key);

      expect(otherPhone.status).toBe(409);
      expect(otherPhone.text).toBe(otherBody.text);
      expect(await client.customerOrder.count()).toBe(1);
    });

    it("creates one order for ten identical requests in parallel", async () => {
      const body = orderFor(await oneProduct());
      const key = newKey();

      const responses = await Promise.all(Array.from({ length: 10 }, () => post(body, key)));

      expect(responses.map((response) => response.status)).toEqual(Array(10).fill(201));
      expect(new Set(responses.map((response) => response.text)).size).toBe(1);
      expect(await client.customerOrder.count()).toBe(1);
      const replays = responses.filter(
        (response) => response.headers["idempotent-replayed"] === "true",
      );
      expect(replays).toHaveLength(9);
    });

    it("creates one order for two parallel requests with the same key and different phones", async () => {
      const productId = await oneProduct();
      const key = newKey();

      const responses = await Promise.all([
        post(orderFor(productId), key),
        post(orderFor(productId, { phone: "032 11 222 33" }), key),
      ]);

      expect(responses.map((response) => response.status).sort()).toEqual([201, 409]);
      expect(await client.customerOrder.count()).toBe(1);
    });
  });

  describe("requests that must not reach the database", () => {
    it("writes nothing for an invalid location", async () => {
      const productId = await oneProduct();
      const before = await countRows(client);

      const response = await post({ ...orderFor(productId), location: { lat: 91, lng: 47.5 } });

      expect(response.status).toBe(400);
      expect(findChangedTables(before, await countRows(client))).toEqual([]);
    });

    it("writes nothing for a price sent by the client", async () => {
      const productId = await oneProduct();
      const before = await countRows(client);

      const response = await post({ ...orderFor(productId), totalAr: 1 });

      expect(response.status).toBe(400);
      expect(findChangedTables(before, await countRows(client))).toEqual([]);
    });
  });

  describe("typed errors with the real service", () => {
    it("answers the fixed 403 for a blocked customer", async () => {
      const productId = await oneProduct();
      await client.customer.create({ data: { phoneE164: FAKE_PHONE_E164, trustLevel: "BLOCKED" } });

      const response = await post(orderFor(productId));

      expect(response.status).toBe(403);
      expect(response.body).toEqual({
        type: "about:blank",
        title: "Forbidden",
        status: 403,
        detail: "This order cannot be placed.",
        instance: ORDERS_PATH,
      });
      expect(await client.customerOrder.count()).toBe(0);
    });

    it.each([
      ["unknown", (): Promise<string> => Promise.resolve("00000000-0000-4000-8000-0000000000ff")],
      ["inactive", (): Promise<string> => insertProduct(client, { active: false })],
      ["unavailable", (): Promise<string> => insertProduct(client, { available: false })],
    ])(
      "answers one fixed 422 for a %s product, listing only the id the client sent",
      async (_name, make) => {
        const productId = await make();

        const response = await post(orderFor(productId));

        expect(response.status).toBe(422);
        // The ids come from the request, which the request schema has already checked: they
        // always pass the (uuid, at most 30) response schema.
        expect(problemDetailsSchema.safeParse(response.body).success).toBe(true);
        expect(response.body).toEqual({
          type: "about:blank",
          title: "Unprocessable Entity",
          status: 422,
          detail: "Some products are not available.",
          instance: ORDERS_PATH,
          productIds: [productId],
        });
      },
    );

    it("lists only the unusable ids, as the client wrote them, among usable ones", async () => {
      const usable = await oneProduct();
      const unusable = await insertProduct(client, { available: false });
      const body = buildOrderRequest([
        { productId: usable, quantity: 1 },
        { productId: unusable.toUpperCase(), quantity: 1 },
      ]);

      const response = await post(body);

      expect(response.status).toBe(422);
      expect((response.body as { productIds: string[] }).productIds).toEqual([
        unusable.toUpperCase(),
      ]);
      expect(problemDetailsSchema.safeParse(response.body).success).toBe(true);
    });

    it("answers a fixed 422 for an order that is too large", async () => {
      const productId = await oneProduct({ priceAr: 1_000_000_000 });

      const response = await post(buildOrderRequest([{ productId, quantity: 3 }]));

      expect(response.status).toBe(422);
      expect(response.body).toEqual({
        type: "about:blank",
        title: "Unprocessable Entity",
        status: 422,
        detail: "The order total is too large.",
        instance: ORDERS_PATH,
      });
    });

    it("refuses a sixth order within an hour for one phone, with the body of the address limit", async () => {
      const productId = await oneProduct();
      for (let count = 0; count < 5; count += 1) {
        expect((await post(orderFor(productId))).status).toBe(201);
      }

      const response = await post(orderFor(productId));

      expect(response.status).toBe(429);
      expect(response.headers["retry-after"]).toBe("600");
      expect(response.body).toEqual(FIXED_429);
      expect(await client.customerOrder.count()).toBe(5);
    });
  });
});
