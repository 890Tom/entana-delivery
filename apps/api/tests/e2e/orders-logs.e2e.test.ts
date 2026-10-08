import type { NestExpressApplication } from "@nestjs/platform-express";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { buildObservedDatabaseError } from "../support/observed-database-errors.js";
import { FAKE_CONTACT_NAME, FAKE_PHONE_INPUT } from "../support/order-request.js";
import { ORDERS_PATH, buildFakeBody, newKey } from "../support/order-http.js";
import { captureLogs } from "./support/log-capture.js";
import { startOrdersApp } from "./support/start-orders-app.js";
import type { OrderServiceDouble } from "./support/start-orders-app.js";
import { buildTestConfig } from "./support/test-config.js";

const FORBIDDEN = [FAKE_PHONE_INPUT, "349876543", FAKE_CONTACT_NAME, "boom"];

describe("what POST /api/v1/orders writes to the logs when it fails", () => {
  const logs = captureLogs();
  const createOrder = vi.fn<OrderServiceDouble["createOrder"]>();
  let app: NestExpressApplication;

  beforeAll(async () => {
    app = await startOrdersApp(buildTestConfig({ LOG_LEVEL: "info" }), {
      service: { createOrder },
      logs: logs.stream,
    });
  });
  afterAll(async () => {
    await app.close();
  });
  beforeEach(() => {
    createOrder.mockReset();
    logs.reset();
  });

  function send(): request.Test {
    return request(app.getHttpServer())
      .post(ORDERS_PATH)
      .set("Idempotency-Key", newKey())
      .set("Content-Type", "application/json")
      .send(JSON.stringify(buildFakeBody()));
  }

  it("logs the type of an unknown error, never its message", async () => {
    createOrder.mockRejectedValue(new Error(`boom ${FAKE_PHONE_INPUT} ${FAKE_CONTACT_NAME}`));

    const response = await send();

    expect(response.status).toBe(500);
    const failureLines = logs.entries().filter((entry) => !("responseTime" in entry));
    expect(failureLines).toHaveLength(1);
    expect(failureLines[0]).toMatchObject({ level: 50 });
    for (const text of FORBIDDEN) {
      expect(logs.text()).not.toContain(text);
    }
  });

  it("logs only the kind of a database failure", async () => {
    createOrder.mockRejectedValue(buildObservedDatabaseError("connection"));

    const response = await send();

    expect(response.status).toBe(503);
    expect(logs.entries().some((entry) => entry.reason === "connection")).toBe(true);
    for (const text of FORBIDDEN) {
      expect(logs.text()).not.toContain(text);
    }
  });

  it("logs one access line and nothing of the request for a refused content type", async () => {
    const response = await request(app.getHttpServer())
      .post(ORDERS_PATH)
      .set("Content-Type", "text/plain")
      .send(`${FAKE_PHONE_INPUT} ${FAKE_CONTACT_NAME}`);

    expect(response.status).toBe(415);
    expect(logs.entries().filter((entry) => "responseTime" in entry)).toHaveLength(1);
    for (const text of FORBIDDEN) {
      expect(logs.text()).not.toContain(text);
    }
  });
});
