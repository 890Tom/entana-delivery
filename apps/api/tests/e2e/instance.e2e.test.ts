import { publicInstanceSchema } from "@entana/contracts";
import type { NestExpressApplication } from "@nestjs/platform-express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApplication } from "../../src/create-application.js";
import { InvalidInstanceConfigurationError } from "../../src/instance/invalid-instance-configuration-error.js";
import { startRealApp } from "./support/create-test-app.js";
import { buildTestConfig } from "./support/test-config.js";

describe("GET /api/v1/instance", () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    app = await startRealApp(buildTestConfig());
  });
  afterAll(async () => {
    await app.close();
  });

  it("answers the public schema, cached for a minute, with no internal key", async () => {
    const response = await request(app.getHttpServer()).get("/api/v1/instance");

    expect(response.status).toBe(200);
    expect(response.headers["cache-control"]).toBe("public, max-age=60");
    expect(publicInstanceSchema.parse(response.body)).toEqual({
      name: "Boutique de démonstration",
      locale: { default: "fr", available: ["fr"] },
      currency: "MGA",
      phoneCountryCode: "261",
      logoUrl: null,
      appIconUrl: null,
    });
    expect(Object.keys(response.body as object).sort()).toEqual([
      "appIconUrl",
      "currency",
      "locale",
      "logoUrl",
      "name",
      "phoneCountryCode",
    ]);
    expect(JSON.stringify(response.body)).not.toMatch(/timezone|Antananarivo|instance\.config/);
  });
});

describe("startup without an instance configuration", () => {
  it("refuses to build the application in production when the file is missing", async () => {
    const config = buildTestConfig({ NODE_ENV: "production" });

    await expect(createApplication(config)).rejects.toBeInstanceOf(
      InvalidInstanceConfigurationError,
    );
  });
});
