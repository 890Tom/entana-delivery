import type { NestExpressApplication } from "@nestjs/platform-express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startTrackingApp } from "./support/start-tracking-app.js";
import { buildTestConfig } from "./support/test-config.js";
import { FAKE_VIEW } from "../support/tracking-http.js";

interface Document {
  readonly paths: Record<string, Record<string, { responses: Record<string, unknown> }>>;
  readonly components: { securitySchemes: Record<string, unknown> };
}

describe("the OpenAPI document of the tracking routes", () => {
  let app: NestExpressApplication;
  let document: Document;
  let documentText: string;

  beforeAll(async () => {
    app = await startTrackingApp(buildTestConfig(), {
      service: {
        getTracking: () => Promise.resolve(FAKE_VIEW),
        cancelOrder: () => Promise.resolve(FAKE_VIEW),
      },
    });
    documentText = (await request(app.getHttpServer()).get("/api/docs-json")).text;
    document = JSON.parse(documentText) as Document;
  });
  afterAll(async () => {
    await app.close();
  });

  it.each([
    ["/api/v1/tracking", "get", ["200", "404", "429", "500", "503"]],
    ["/api/v1/tracking/cancel", "post", ["200", "404", "409", "429", "500", "503"]],
    ["/api/v1/tracking/lookup", "post", ["200", "400", "404", "415", "429", "500", "503"]],
  ] as const)("documents %s", (path, method, statuses) => {
    const operation = document.paths[path]?.[method];

    expect(Object.keys(operation?.responses ?? {})).toEqual(expect.arrayContaining([...statuses]));
  });

  it("declares the token as an API key in the X-Tracking-Token header", () => {
    expect(document.components.securitySchemes).toMatchObject({
      trackingToken: { type: "apiKey", in: "header", name: "X-Tracking-Token" },
    });
  });

  it("does not ask for the token on the lookup, which is made without one", () => {
    expect(document.paths["/api/v1/tracking/lookup"]?.post).not.toHaveProperty("security");
  });

  it("uses an obviously fake phone number as the lookup example", () => {
    expect(documentText).toContain("034 00 000 00");
  });

  it("uses an obviously fake token as its example", () => {
    expect(documentText).toContain("A".repeat(43));
  });
});
