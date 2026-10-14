import type { NestExpressApplication } from "@nestjs/platform-express";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { DETAILS } from "../support/order-http.js";
import { startRealApp } from "./support/create-test-app.js";
import { captureLogs } from "./support/log-capture.js";
import { buildTestConfig } from "./support/test-config.js";

const QUOTE_PATH = "/api/v1/delivery/quote";
// Distinctive values: found in a log only if the coordinates were written there.
const VALID_BODY = { latitude: -18.913579, longitude: 47.524681, pieces: 3 };

function validationProblem(pointer: string, detail: string): Record<string, unknown> {
  return {
    type: "urn:entana:problem:validation-error",
    title: "Bad Request",
    status: 400,
    detail: "The request is invalid.",
    instance: QUOTE_PATH,
    errors: [{ pointer, detail }],
  };
}

describe("the HTTP contract of POST /api/v1/delivery/quote", () => {
  const logs = captureLogs();
  let app: NestExpressApplication;

  beforeAll(async () => {
    // No database listens here: a valid body reaches the database and fails with 503.
    app = await startRealApp(buildTestConfig({ LOG_LEVEL: "info" }), logs.stream);
  });
  afterAll(async () => {
    await app.close();
  });
  beforeEach(() => {
    logs.reset();
  });

  const post = (body: object): request.Test =>
    request(app.getHttpServer())
      .post(QUOTE_PATH)
      .set("Content-Type", "application/json")
      .send(body);

  it.each([
    ["a latitude out of range", { ...VALID_BODY, latitude: 91 }, "/latitude", DETAILS.too_big],
    ["pieces of 0", { ...VALID_BODY, pieces: 0 }, "/pieces", DETAILS.too_small],
    ["a missing field", { latitude: 0, longitude: 0 }, "/pieces", DETAILS.invalid_type],
  ])("answers 400 problem+json for %s", async (_name, body, pointer, detail) => {
    const response = await post(body);

    expect(response.status).toBe(400);
    expect(response.headers["content-type"]).toMatch(/^application\/problem\+json/);
    expect(response.body).toEqual(validationProblem(pointer, detail));
  });

  it("answers 415 for another content type", async () => {
    const response = await request(app.getHttpServer())
      .post(QUOTE_PATH)
      .set("Content-Type", "text/plain")
      .send("latitude=0");

    expect(response.status).toBe(415);
  });

  it("writes no coordinate to the logs", async () => {
    const response = await post(VALID_BODY);

    expect(response.status).toBe(503);
    expect(logs.entries().length).toBeGreaterThan(0);
    expect(logs.text()).not.toContain("18.913579");
    expect(logs.text()).not.toContain("47.524681");
  });

  it("is documented in OpenAPI with its body", async () => {
    const response = await request(app.getHttpServer()).get("/api/docs-json");
    const document = JSON.parse(response.text) as {
      paths: Record<string, { post?: { operationId?: string; requestBody?: unknown } }>;
    };
    const operation = document.paths[QUOTE_PATH]?.post;

    expect(operation?.operationId).toBe("quoteDelivery");
    expect(JSON.stringify(operation?.requestBody)).toContain("pieces");
  });
});
