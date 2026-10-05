import type { NestExpressApplication } from "@nestjs/platform-express";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { startAppWithProbe } from "./support/create-test-app.js";
import { captureLogs } from "./support/log-capture.js";
import type { LogCapture } from "./support/log-capture.js";
import { buildTestConfig } from "./support/test-config.js";

describe("request logging", () => {
  let app: NestExpressApplication;
  const logs: LogCapture = captureLogs();

  // One application for the whole file: nestjs-pino keeps a single logger per process, so a
  // second application would write to the destination of the first one.
  beforeAll(async () => {
    app = await startAppWithProbe(buildTestConfig({ LOG_LEVEL: "info" }), logs.stream);
  });
  afterAll(async () => {
    await app.close();
  });
  // Rule of this file: a test awaits its own access log (firstRequestLog) before it ends, so that
  // a late line cannot land in the next test after this reset.
  beforeEach(() => {
    logs.reset();
  });

  function requestLogs(): Record<string, unknown>[] {
    return logs.entries().filter((entry) => "responseTime" in entry);
  }

  // The access log is written when the response is finished, which can be after the client
  // received it.
  async function firstRequestLog(): Promise<Record<string, unknown>> {
    await vi.waitFor(() => {
      expect(requestLogs()).toHaveLength(1);
    });
    return requestLogs()[0] ?? {};
  }

  it("writes one JSON line per request with the status and the route", async () => {
    await request(app.getHttpServer()).get("/api/v1/health");

    expect(await firstRequestLog()).toMatchObject({
      req: { method: "GET" },
      route: "/api/v1/health",
      res: { statusCode: 200 },
    });
  });

  it("logs a request that matches no route as a warning", async () => {
    await request(app.getHttpServer()).get("/api/v1/nope");

    expect(await firstRequestLog()).toMatchObject({
      level: 40,
      route: "unmatched",
      res: { statusCode: 404 },
    });
  });

  it("logs the route template, never the value of a path parameter", async () => {
    const token = "tRaCkInGtOkEn-9f8e7d6c5b4a";

    await request(app.getHttpServer()).get(`/api/v1/probe/items/${token}`);

    expect(await firstRequestLog()).toMatchObject({ route: "/api/v1/probe/items/:token" });
    expect(logs.text()).not.toContain(token);
  });

  it("does not log the raw path of a request that matches no route", async () => {
    await request(app.getHttpServer()).get("/api/v1/secret-looking-path-1234");

    expect(await firstRequestLog()).toMatchObject({ route: "unmatched" });
    expect(logs.text()).not.toContain("secret-looking-path-1234");
  });

  it("does not log the query string", async () => {
    await request(app.getHttpServer()).get("/api/v1/health?phone=0340000000&code=ABC123");

    await firstRequestLog();
    expect(logs.text()).not.toContain("0340000000");
    expect(logs.text()).not.toContain("ABC123");
  });

  it("does not log the client address", async () => {
    await request(app.getHttpServer()).get("/api/v1/health").set("X-Forwarded-For", "203.0.113.7");

    await firstRequestLog();
    expect(logs.text()).not.toContain("203.0.113.7");
    expect(logs.text()).not.toContain("remoteAddress");
  });

  it("does not log credentials sent in headers", async () => {
    await request(app.getHttpServer())
      .get("/api/v1/health")
      .set("Authorization", "Bearer very-secret-token")
      .set("Cookie", "session=very-secret-cookie");

    await firstRequestLog();
    expect(logs.text()).not.toContain("very-secret");
  });

  describe("request id", () => {
    it("reuses a well-formed incoming id, in the response and in the logs", async () => {
      const id = "7d9f1c3e-5b1a-4c55-9a43-2f6c0b6d8e21";

      const response = await request(app.getHttpServer())
        .get("/api/v1/health")
        .set("X-Request-Id", id);

      expect(response.headers["x-request-id"]).toBe(id);
      expect(await firstRequestLog()).toMatchObject({ req: { id } });
    });

    it("replaces an incoming id that has an unsafe format", async () => {
      const response = await request(app.getHttpServer())
        .get("/api/v1/health")
        .set("X-Request-Id", "<script>alert(1)</script>");

      const id = response.headers["x-request-id"];
      expect(id).toMatch(/^[0-9a-f-]{36}$/);
      expect(await firstRequestLog()).toMatchObject({ req: { id } });
      expect(logs.text()).not.toContain("<script>");
    });

    it("gives the error log of a failing request the same id as the response", async () => {
      const response = await request(app.getHttpServer()).get("/api/v1/probe/boom");

      await firstRequestLog();
      // The line written by the exception filter, not the access log (which has a response time).
      const stackStartingWithErrorType: unknown = expect.stringMatching(/^Error\n\s+at /);
      const errorLog = logs
        .entries()
        .find((entry) => entry.level === 50 && !("responseTime" in entry));
      expect(errorLog).toMatchObject({
        req: { id: response.headers["x-request-id"] },
        msg: stackStartingWithErrorType,
      });
    });

    it("keeps the message of an unexpected error out of the logs", async () => {
      await request(app.getHttpServer()).get("/api/v1/probe/boom");

      await firstRequestLog();
      expect(logs.text()).not.toContain("secret internal detail");
      expect(logs.text()).not.toContain("db.internal");
    });
  });
});
