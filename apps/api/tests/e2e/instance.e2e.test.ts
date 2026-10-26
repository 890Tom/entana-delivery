import { fileURLToPath } from "node:url";
import { publicInstanceSchema } from "@entana/contracts";
import type { NestExpressApplication } from "@nestjs/platform-express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
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
      contactPhone: null,
      theme: null,
      map: {
        styleUrl: "https://tiles.openfreemap.org/styles/liberty",
        center: { lat: -18.91, lng: 47.52 },
        zoom: 12,
      },
    });
    expect(Object.keys(response.body as object).sort()).toEqual([
      "appIconUrl",
      "contactPhone",
      "currency",
      "locale",
      "logoUrl",
      "map",
      "name",
      "phoneCountryCode",
      "theme",
    ]);
    expect(JSON.stringify(response.body)).not.toMatch(/timezone|Antananarivo|instance\.config/);
  });
});

const COLORS_CONFIG_PATH = fileURLToPath(
  new URL("./fixtures/instance-with-colors.yaml", import.meta.url),
);

describe("GET /api/v1/instance with brand colours", () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    app = await startRealApp(buildTestConfig({ INSTANCE_CONFIG_PATH: COLORS_CONFIG_PATH }));
  });
  afterAll(async () => {
    await app.close();
  });

  it("answers the theme derived from the colours of the file", async () => {
    const response = await request(app.getHttpServer()).get("/api/v1/instance");

    expect(response.status).toBe(200);
    expect(publicInstanceSchema.parse(response.body).theme).toEqual({
      accent: "#2d6cdf",
      accentSoft: "#e0e9fa",
      accentStrong: "#2961c9",
      textOnAccent: "#ffffff",
      action: "#2b2b2b",
      actionHover: "#555555",
      textOnAction: "#ffffff",
    });
  });
});
