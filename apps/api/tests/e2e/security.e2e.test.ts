import type { NestExpressApplication } from "@nestjs/platform-express";
import { tmpdir } from "node:os";
import request from "supertest";
import { z } from "zod";
import { afterEach, describe, expect, it } from "vitest";
import { startAppWithProbe, startRealApp } from "./support/create-test-app.js";
import { DEMO_INSTANCE_CONFIG_PATH, buildTestConfig } from "./support/test-config.js";

const clientSchema = z.object({ ip: z.string() });
const openApiSchema = z.object({
  openapi: z.string(),
  paths: z.record(z.string(), z.object({ get: z.unknown().optional() })),
});

let app: NestExpressApplication | undefined;

afterEach(async () => {
  await app?.close();
  app = undefined;
});

describe("security headers", () => {
  it("sends the helmet headers and does not advertise Express", async () => {
    app = await startRealApp(buildTestConfig());
    const response = await request(app.getHttpServer()).get("/api/v1/health");

    expect(response.headers["x-content-type-options"]).toBe("nosniff");
    expect(response.headers["x-frame-options"]).toBe("SAMEORIGIN");
    expect(response.headers["content-security-policy"]).toContain("default-src 'self'");
    expect(response.headers["strict-transport-security"]).toContain("max-age=");
    expect(response.headers["x-powered-by"]).toBeUndefined();
  });
});

describe("content security policy", () => {
  it("makes browsers upgrade insecure requests in production", async () => {
    app = await startRealApp(
      buildTestConfig({
        NODE_ENV: "production",
        INSTANCE_CONFIG_PATH: DEMO_INSTANCE_CONFIG_PATH,
        MEDIA_ROOT: tmpdir(),
      }),
    );
    const response = await request(app.getHttpServer()).get("/api/v1/health");

    expect(response.headers["content-security-policy"]).toContain("upgrade-insecure-requests");
  });

  it("does not in development, where the server may be plain HTTP", async () => {
    app = await startRealApp(buildTestConfig({ NODE_ENV: "development" }));
    const response = await request(app.getHttpServer()).get("/api/v1/health");

    expect(response.headers["content-security-policy"]).toContain("default-src 'self'");
    expect(response.headers["content-security-policy"]).not.toContain("upgrade-insecure-requests");
  });
});

describe("CORS", () => {
  const allowed = "https://shop.example.mg";

  it("allows a configured origin", async () => {
    app = await startRealApp(buildTestConfig({ CORS_ORIGINS: allowed }));
    const response = await request(app.getHttpServer())
      .get("/api/v1/health")
      .set("Origin", allowed);

    expect(response.headers["access-control-allow-origin"]).toBe(allowed);
  });

  it("answers the preflight of a configured origin", async () => {
    app = await startRealApp(buildTestConfig({ CORS_ORIGINS: allowed }));
    const response = await request(app.getHttpServer())
      .options("/api/v1/health")
      .set("Origin", allowed)
      .set("Access-Control-Request-Method", "GET");

    expect(response.status).toBeLessThan(300);
    expect(response.headers["access-control-allow-origin"]).toBe(allowed);
  });

  it("does not allow another origin", async () => {
    app = await startRealApp(buildTestConfig({ CORS_ORIGINS: allowed }));
    const response = await request(app.getHttpServer())
      .get("/api/v1/health")
      .set("Origin", "https://evil.example");

    expect(response.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("allows no origin at all when none is configured", async () => {
    app = await startRealApp(buildTestConfig());
    const response = await request(app.getHttpServer())
      .get("/api/v1/health")
      .set("Origin", allowed);

    expect(response.headers["access-control-allow-origin"]).toBeUndefined();
  });
});

describe("trust proxy", () => {
  const forwarded = "203.0.113.7";

  it("ignores X-Forwarded-For by default, so that a client cannot choose its address", async () => {
    app = await startAppWithProbe(buildTestConfig());
    const response = await request(app.getHttpServer())
      .get("/api/v1/probe/client")
      .set("X-Forwarded-For", forwarded);

    expect(clientSchema.parse(response.body).ip).not.toContain(forwarded);
  });

  it("reads the address added by the proxy when one hop is trusted", async () => {
    app = await startAppWithProbe(buildTestConfig({ TRUST_PROXY: "1" }));
    const response = await request(app.getHttpServer())
      .get("/api/v1/probe/client")
      .set("X-Forwarded-For", forwarded);

    expect(clientSchema.parse(response.body).ip).toBe(forwarded);
  });

  it("takes the address added by the proxy, not the first one, which the client can forge", async () => {
    app = await startAppWithProbe(buildTestConfig({ TRUST_PROXY: "1" }));
    const response = await request(app.getHttpServer())
      .get("/api/v1/probe/client")
      .set("X-Forwarded-For", `198.51.100.9, ${forwarded}`);

    expect(clientSchema.parse(response.body).ip).toBe(forwarded);
  });

  it("goes back one more address for each additional trusted proxy", async () => {
    app = await startAppWithProbe(buildTestConfig({ TRUST_PROXY: "2" }));
    const response = await request(app.getHttpServer())
      .get("/api/v1/probe/client")
      .set("X-Forwarded-For", `198.51.100.9, ${forwarded}`);

    expect(clientSchema.parse(response.body).ip).toBe("198.51.100.9");
  });
});

describe("API documentation", () => {
  it("serves the Swagger UI and the OpenAPI document when enabled", async () => {
    app = await startRealApp(buildTestConfig({ SWAGGER_ENABLED: "true" }));

    const page = await request(app.getHttpServer()).get("/api/docs");
    expect(page.status).toBe(200);
    expect(page.headers["content-type"]).toMatch(/^text\/html/);

    const document = await request(app.getHttpServer()).get("/api/docs-json");
    expect(document.status).toBe(200);
    const openApi = openApiSchema.parse(document.body);
    expect(openApi.openapi).toMatch(/^3\./);
    expect(openApi.paths["/api/v1/health"]?.get).toBeDefined();
  });

  it("serves nothing when disabled", async () => {
    app = await startRealApp(buildTestConfig({ SWAGGER_ENABLED: "false" }));

    expect((await request(app.getHttpServer()).get("/api/docs")).status).toBe(404);
    expect((await request(app.getHttpServer()).get("/api/docs-json")).status).toBe(404);
  });

  it("is off by default in production", async () => {
    app = await startRealApp(
      buildTestConfig({
        NODE_ENV: "production",
        INSTANCE_CONFIG_PATH: DEMO_INSTANCE_CONFIG_PATH,
        MEDIA_ROOT: tmpdir(),
      }),
    );

    expect((await request(app.getHttpServer()).get("/api/docs")).status).toBe(404);
  });
});
