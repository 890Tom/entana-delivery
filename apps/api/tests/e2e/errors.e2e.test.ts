import { problemDetailsSchema } from "@entana/contracts";
import type { NestExpressApplication } from "@nestjs/platform-express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startAppWithProbe, startRealApp } from "./support/create-test-app.js";
import { buildTestConfig } from "./support/test-config.js";

describe("error responses", () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    app = await startAppWithProbe(buildTestConfig({ BODY_LIMIT_KB: "1" }));
  });
  afterAll(async () => {
    await app.close();
  });

  it("answers an unknown route with a 404 problem", async () => {
    const response = await request(app.getHttpServer()).get("/api/v1/unknown?x=1");

    expect(response.status).toBe(404);
    expect(response.headers["content-type"]).toMatch(/^application\/problem\+json/);
    expect(problemDetailsSchema.parse(response.body)).toMatchObject({
      type: "about:blank",
      title: "Not Found",
      status: 404,
      instance: "/api/v1/unknown",
    });
  });

  it("lists the invalid fields of a request body", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/v1/probe/validation")
      .send({ name: "", quantity: -2 });

    expect(response.status).toBe(400);
    expect(response.headers["content-type"]).toMatch(/^application\/problem\+json/);
    const problem = problemDetailsSchema.parse(response.body);
    expect(problem.type).toBe("urn:entana:problem:validation-error");
    expect(problem.instance).toBe("/api/v1/probe/validation");
    expect(problem.errors?.map((error) => error.pointer).sort()).toEqual(["/name", "/quantity"]);
  });

  it("accepts a valid request body", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/v1/probe/validation")
      .send({ name: "Rice", quantity: 2 });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({ name: "Rice", quantity: 2 });
  });

  it("answers malformed JSON with a 400 problem", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/v1/probe/validation")
      .set("Content-Type", "application/json")
      .send('{"name": ');

    expect(response.status).toBe(400);
    expect(response.headers["content-type"]).toMatch(/^application\/problem\+json/);
    expect(problemDetailsSchema.parse(response.body)).toMatchObject({
      status: 400,
      detail: "The request body is not valid JSON.",
    });
  });

  it("refuses a body over the size limit with a 413 problem", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/v1/probe/validation")
      .send({ name: "x".repeat(2000), quantity: 1 });

    expect(response.status).toBe(413);
    expect(response.headers["content-type"]).toMatch(/^application\/problem\+json/);
    expect(problemDetailsSchema.parse(response.body).status).toBe(413);
  });

  it("hides everything about an unexpected error", async () => {
    const response = await request(app.getHttpServer()).get("/api/v1/probe/boom");

    expect(response.status).toBe(500);
    expect(response.headers["content-type"]).toMatch(/^application\/problem\+json/);
    expect(problemDetailsSchema.parse(response.body).detail).toBe("An unexpected error occurred.");
    expect(response.text).not.toContain("secret internal detail");
    expect(response.text).not.toContain("db.internal");
    expect(response.text).not.toMatch(/\bat\s.+:\d+:\d+/);
  });
});

describe("the real application", () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    app = await startRealApp(buildTestConfig());
  });
  afterAll(async () => {
    await app.close();
  });

  it.each([
    ["post", "/api/v1/probe/validation"],
    ["get", "/api/v1/probe/boom"],
    ["get", "/api/v1/probe/items/abc"],
    ["get", "/api/v1/probe/client"],
  ] as const)("has no test-only route: %s %s answers 404", async (method, path) => {
    const response = await request(app.getHttpServer())[method](path);
    expect(response.status).toBe(404);
  });
});
