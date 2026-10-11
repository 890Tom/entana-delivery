import request from "supertest";
import { describe, expect, it } from "vitest";
import { createPrismaClient } from "@entana/database";
import { generateTrackingToken } from "../support/order-request.js";
import { startAppWithClient } from "./support/create-test-app.js";
import { captureLogs } from "./support/log-capture.js";
import { buildTestConfig } from "./support/test-config.js";
import {
  TRACKING_HEADER,
  TRACKING_PATH,
  TRACKING_RESPONSE_HEADERS,
} from "../support/tracking-http.js";

describe("GET /api/v1/tracking without a reachable database", () => {
  it("answers the fixed 503, with the protection headers, and logs nothing of the request", async () => {
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
    const token = generateTrackingToken();
    try {
      const response = await request(app.getHttpServer())
        .get(TRACKING_PATH)
        .set(TRACKING_HEADER, token);

      expect(response.status).toBe(503);
      expect(response.body).toEqual({
        type: "about:blank",
        title: "Service Unavailable",
        status: 503,
        detail: "The service is temporarily unavailable.",
        instance: TRACKING_PATH,
      });
      expect(response.headers).toMatchObject(TRACKING_RESPONSE_HEADERS);
      expect(logs.text()).not.toMatch(new RegExp(`${token}|user-fake|pass-fake|db-fake`));
    } finally {
      await app.close();
    }
  });
});
