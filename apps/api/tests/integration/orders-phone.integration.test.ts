import type { PrismaClient } from "@entana/database";
import type { NestExpressApplication } from "@nestjs/platform-express";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, inject, it } from "vitest";
import { startOrdersApp } from "../e2e/support/start-orders-app.js";
import { buildTestConfig } from "../e2e/support/test-config.js";
import {
  INVALID_PHONE_DETAIL,
  ORDERS_PATH,
  newKey,
  validationProblem,
} from "../support/order-http.js";
import { FAKE_PHONE_E164, buildOrderRequest } from "../support/order-request.js";
import { countRows, findChangedTables } from "./support/count-rows.js";
import { insertProduct } from "./support/insert-product.js";
import { openOrdersClient, resetOrderData } from "./support/orders-fixtures.js";

describe("the numbering plan on POST /api/v1/orders, on a real PostgreSQL", () => {
  const client: PrismaClient = openOrdersClient();
  let app: NestExpressApplication;
  let productId: string;

  beforeAll(async () => {
    app = await startOrdersApp(
      buildTestConfig({ DATABASE_URL: inject("throwawayConnectionString") }),
    );
  });
  beforeEach(async () => {
    await resetOrderData(client);
    productId = await insertProduct(client, { priceAr: 5000 });
  });
  afterAll(async () => {
    await app.close();
    await resetOrderData(client);
    await client.$disconnect();
  });

  const post = (phone: string): request.Test =>
    request(app.getHttpServer())
      .post(ORDERS_PATH)
      .set("Idempotency-Key", newKey())
      .set("Content-Type", "application/json")
      .send(JSON.stringify(buildOrderRequest([{ productId, quantity: 1 }], { phone })));

  it("creates one customer for two forms of the same number, stored in the canonical form", async () => {
    const national = await post("034 98 765 43");
    const international = await post("+261 34 98 765 43");

    expect([national.status, international.status]).toEqual([201, 201]);
    const customers = await client.customer.findMany();
    expect(customers.map((customer) => customer.phoneE164)).toEqual([FAKE_PHONE_E164]);
  });

  it("answers the fixed 400 on /phone for a prefix outside the plan, without the input, and writes nothing", async () => {
    const before = await countRows(client);

    const response = await post("031 12 345 67");

    expect(response.status).toBe(400);
    expect(response.body).toEqual(validationProblem([["/phone", INVALID_PHONE_DETAIL]]));
    expect(response.text).not.toContain("031");
    expect(findChangedTables(before, await countRows(client))).toEqual([]);
  });
});
