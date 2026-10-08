import type { PrismaClient } from "@entana/database";
import type { NestExpressApplication } from "@nestjs/platform-express";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, inject, it } from "vitest";
import { startOrdersApp } from "../e2e/support/start-orders-app.js";
import { buildTestConfig } from "../e2e/support/test-config.js";
import { buildOrderRequest } from "../support/order-request.js";
import { ORDERS_PATH, newKey } from "../support/order-http.js";
import { countRows, findChangedTables } from "./support/count-rows.js";
import { insertProduct } from "./support/insert-product.js";
import { ManualClock, openOrdersClient, resetOrderData } from "./support/orders-fixtures.js";

// Requests the HTTP layer refuses before the service: not one row may change in any table.
describe("POST /api/v1/orders: refused requests on a real PostgreSQL", () => {
  const client: PrismaClient = openOrdersClient();
  let app: NestExpressApplication;
  let addressCounter = 0;

  beforeAll(async () => {
    app = await startOrdersApp(
      buildTestConfig({
        DATABASE_URL: inject("throwawayConnectionString"),
        TRUST_PROXY: "1",
      }),
      { clock: new ManualClock() },
    );
  });
  beforeEach(async () => {
    await resetOrderData(client);
  });
  afterAll(async () => {
    await app.close();
    await resetOrderData(client);
    await client.$disconnect();
  });

  async function postRaw(contentType: string, payload: string, extra = ""): Promise<number> {
    addressCounter += 1;
    const productId = await insertProduct(client, { priceAr: 5000 });
    const before = await countRows(client);
    const response = await request(app.getHttpServer())
      .post(ORDERS_PATH)
      .set("X-Forwarded-For", `192.0.2.${String(addressCounter % 250)}`)
      .set("Origin", "https://other-site.example")
      .set("Idempotency-Key", newKey())
      .set("Content-Type", contentType)
      .send(payload.replace("{PRODUCT}", productId).replace("{EXTRA}", extra));
    expect(findChangedTables(before, await countRows(client))).toEqual([]);
    return response.status;
  }

  const body = (): string =>
    JSON.stringify(buildOrderRequest([{ productId: "{PRODUCT}", quantity: 1 }])).replace(
      "{",
      "{{EXTRA}",
    );

  it.each([
    ["text/plain"],
    ["application/x-www-form-urlencoded"],
    ["multipart/form-data; boundary=FAKE"],
    ["application/vnd.api+json"],
    ["application/json; charset=latin1"],
  ])("answers 415 and writes nothing for the content type %s", async (contentType) => {
    expect(await postRaw(contentType, body())).toBe(415);
  });

  it.each(["__proto__", "constructor", "prototype"])(
    "answers 400 and writes nothing for an own %s key",
    async (key) => {
      expect(await postRaw("application/json", body(), `"${key}":{"x":1},`)).toBe(400);
      expect(Object.hasOwn(Object.prototype, "x")).toBe(false);
    },
  );
});
