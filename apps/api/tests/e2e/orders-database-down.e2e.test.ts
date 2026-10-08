import request from "supertest";
import { describe, expect, it } from "vitest";
import { createPrismaClient } from "@entana/database";
import { generateTrackingToken } from "../support/order-request.js";
import { startAppWithClient } from "./support/create-test-app.js";
import { captureLogs } from "./support/log-capture.js";
import { buildTestConfig } from "./support/test-config.js";
import { ORDERS_PATH, buildFakeBody, newKey, problemBody } from "../support/order-http.js";

describe("POST /api/v1/orders without a reachable database", () => {
  it("answers the fixed 503 and logs nothing about the request", async () => {
    const logs = captureLogs();
    const client = createPrismaClient({
      connectionString: "postgresql://user-fake:pass-fake@127.0.0.1:1/db-fake",
      connectionTimeoutMs: 300,
    });
    const app = await startAppWithClient(
      buildTestConfig({ LOG_LEVEL: "info" }),
      client,
      logs.stream,
    );
    try {
      const response = await request(app.getHttpServer())
        .post(ORDERS_PATH)
        .set("Idempotency-Key", newKey())
        .set("Content-Type", "application/json")
        .send(JSON.stringify({ ...buildFakeBody(), trackingToken: generateTrackingToken() }));

      expect(response.status).toBe(503);
      expect(response.body).toEqual(
        problemBody(503, "Service Unavailable", "The service is temporarily unavailable."),
      );
      expect(logs.text()).not.toMatch(/user-fake|pass-fake|db-fake|127\.0\.0\.1|FAKE|Zanakolona/);
    } finally {
      await app.close();
    }
  });
});
