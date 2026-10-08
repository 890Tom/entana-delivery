import type { CreateOrderRequest } from "@entana/contracts";
import type { PrismaClient } from "@entana/database";
import type { NestExpressApplication } from "@nestjs/platform-express";
import request from "supertest";
import type { Response } from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, inject, it } from "vitest";
import { startOrdersApp } from "../e2e/support/start-orders-app.js";
import { captureLogs } from "../e2e/support/log-capture.js";
import { buildTestConfig } from "../e2e/support/test-config.js";
import {
  FAKE_CONTACT_NAME,
  FAKE_LANDMARK,
  FAKE_LAT,
  FAKE_LNG,
  FAKE_NOTE,
  FAKE_PHONE_E164,
  FAKE_PHONE_INPUT,
  buildOrderRequest,
  generateTrackingToken,
} from "../support/order-request.js";
import { ORDERS_PATH, newKey } from "../support/order-http.js";
import { startConsoleCapture } from "./support/console-capture.js";
import { buildForbiddenStrings, collectLeafValues, findLeak } from "./support/forbidden-strings.js";
import type { CapturedOutput, ForbiddenStrings } from "./support/forbidden-strings.js";
import { insertProduct } from "./support/insert-product.js";
import { ManualClock, openOrdersClient, resetOrderData } from "./support/orders-fixtures.js";
import {
  isAccessLine,
  partOfLines,
  stringHeaderValues,
  withoutPinoBaseFields,
} from "./support/output-parts.js";

describe("POST /api/v1/orders leaks on a real PostgreSQL", () => {
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

  describe("no personal data or secret leaves the API", () => {
    const forbiddenValues = [
      FAKE_PHONE_INPUT,
      FAKE_PHONE_E164,
      "349876543",
      FAKE_CONTACT_NAME,
      FAKE_NOTE,
      FAKE_LANDMARK,
      String(FAKE_LAT),
      String(FAKE_LNG),
    ];

    async function captureOf(send: () => request.Test): Promise<CapturedOutput> {
      logs.reset();
      const consoleCapture = startConsoleCapture();
      let response: Response;
      try {
        response = await send();
      } catch (error) {
        consoleCapture.stop();
        throw error;
      }
      const consoleLines = consoleCapture.stop();
      const entries = logs.entries().map(withoutPinoBaseFields);
      // One access line per request, and no other line for these requests.
      expect(entries.filter(isAccessLine)).toHaveLength(1);
      return [
        {
          name: "headers",
          rawTexts: [JSON.stringify(response.headers)],
          values: stringHeaderValues(response),
        },
        { name: "body", rawTexts: [response.text], values: collectLeafValues(response.body) },
        partOfLines("access log", entries.filter(isAccessLine)),
        partOfLines(
          "failure log",
          entries.filter((entry) => !isAccessLine(entry)),
        ),
        { name: "console", rawTexts: consoleLines, values: consoleLines },
      ];
    }

    // Only the raw scan and the token scan: the broad schema names of the value scan are not what
    // this test looks for, and the exact values below cannot be mistaken for our own keys.
    function forbidden(token: string): ForbiddenStrings {
      const strings = buildForbiddenStrings({
        databaseName: inject("throwawayDatabase"),
        schemaObjects: inject("schemaObjects"),
        usedValues: [...forbiddenValues, token],
        password: decodeURIComponent(new URL(inject("throwawayConnectionString")).password),
        connectionString: inject("throwawayConnectionString"),
      });
      return { ...strings, valueScan: [] };
    }

    it.each([
      ["a created order", "ok"],
      ["a replay", "replay"],
      ["a conflict", "conflict"],
      ["an unavailable product", "unavailable"],
      ["an invalid body", "invalid"],
      ["a blocked customer", "blocked"],
    ])("leaks nothing for %s", async (_name, scenario) => {
      const productId = await oneProduct();
      const token = generateTrackingToken();
      const key = newKey();
      const body = orderFor(productId, { trackingToken: token });
      if (scenario === "replay" || scenario === "conflict") {
        await post(body, key);
      }
      if (scenario === "blocked") {
        await client.customer.create({
          data: { phoneE164: FAKE_PHONE_E164, trustLevel: "BLOCKED" },
        });
      }
      const sent = ((): CreateOrderRequest => {
        switch (scenario) {
          case "conflict":
            return { ...body, contactName: `${FAKE_CONTACT_NAME} bis` };
          case "unavailable":
            return buildOrderRequest(
              [{ productId: "00000000-0000-4000-8000-0000000000ff", quantity: 1 }],
              { trackingToken: token },
            );
          default:
            return body;
        }
      })();
      const payload =
        scenario === "invalid" ? { ...sent, location: { lat: 91, lng: FAKE_LNG } } : sent;

      const output = await captureOf(() => post(payload, key));

      expect(findLeak(forbidden(token), output)).toBeUndefined();
    });
  });
});
