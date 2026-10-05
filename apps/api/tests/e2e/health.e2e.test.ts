import { readFileSync } from "node:fs";
import { healthResponseSchema, problemDetailsSchema } from "@entana/contracts";
import type { NestExpressApplication } from "@nestjs/platform-express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startRealApp } from "./support/create-test-app.js";
import { buildTestConfig } from "./support/test-config.js";

describe("GET /api/v1/health", () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    app = await startRealApp(buildTestConfig());
  });
  afterAll(async () => {
    await app.close();
  });

  it("answers 200 with a JSON liveness response that matches the shared schema", async () => {
    const response = await request(app.getHttpServer()).get("/api/v1/health");

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toMatch(/^application\/json/);
    const body = healthResponseSchema.parse(response.body);
    expect(body.status).toBe("ok");
  });

  it("reports the name and the version of the package", async () => {
    const manifest: unknown = JSON.parse(
      readFileSync(new URL("../../package.json", import.meta.url), "utf8"),
    );
    const response = await request(app.getHttpServer()).get("/api/v1/health");
    const body = healthResponseSchema.parse(response.body);

    expect(manifest).toMatchObject({ name: body.service, version: body.version });
  });

  it("is never cached", async () => {
    const response = await request(app.getHttpServer()).get("/api/v1/health");
    expect(response.headers["cache-control"]).toBe("no-store");
  });

  it("returns a request id", async () => {
    const response = await request(app.getHttpServer()).get("/api/v1/health");
    expect(response.headers["x-request-id"]).toMatch(/^[0-9a-f-]{36}$/);
  });

  it.each(["/", "/health", "/api/health", "/api/v2/health"])(
    "has no route at %s: only the versioned path exists",
    async (path) => {
      const response = await request(app.getHttpServer()).get(path);
      expect(response.status).toBe(404);
      expect(problemDetailsSchema.safeParse(response.body).success).toBe(true);
    },
  );
});
