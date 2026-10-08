import { problemDetailsSchema } from "@entana/contracts";
import type { NestExpressApplication } from "@nestjs/platform-express";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { startAppWithProbe } from "./support/create-test-app.js";
import { captureLogs } from "./support/log-capture.js";
import { buildTestConfig } from "./support/test-config.js";

const STRICT_INSTANCE = "/api/v1/probe/strict";
const NOT_FOUND_DETAIL = "The requested resource was not found.";
const VALIDATION_TYPE = "urn:entana:problem:validation-error";
const HOSTILE = ["FAKE-QUERY-8841", "SECRETBODY8841", "polluted8841"];

describe("responses to hostile requests carry no request text", () => {
  let app: NestExpressApplication;
  const logs = captureLogs();

  beforeAll(async () => {
    app = await startAppWithProbe(
      buildTestConfig({ BODY_LIMIT_KB: "1", LOG_LEVEL: "trace" }),
      logs.stream,
    );
  });
  beforeEach(() => {
    logs.reset();
  });
  afterAll(async () => {
    await app.close();
  });

  function http(): ReturnType<typeof request> {
    return request(app.getHttpServer());
  }

  // The path may appear in `instance` only: the detail, the headers and the logs never repeat it.
  function expectNoRequestText(response: request.Response, extra: readonly string[] = []): void {
    const problem = problemDetailsSchema.parse(response.body);
    const { instance, ...rest } = problem;
    const everywhereButInstance =
      JSON.stringify(rest) + JSON.stringify(response.headers) + logs.text();
    for (const text of [...HOSTILE, ...extra]) {
      expect(everywhereButInstance).not.toContain(text);
      expect(instance).not.toContain(text);
    }
    expect(instance).not.toMatch(/[?#]/);
  }

  it("answers an unknown path with a fixed 404 detail and the path as instance", async () => {
    const response = await http().get("/api/v1/FAKE-PATH-8841?x=FAKE-QUERY-8841");

    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({
      detail: NOT_FOUND_DETAIL,
      instance: "/api/v1/FAKE-PATH-8841",
    });
    expectNoRequestText(response);
    expect(logs.text()).not.toContain("FAKE-PATH-8841");
  });

  it("answers an unknown path outside the prefix with the same fixed detail", async () => {
    const response = await http().get("/FAKE-PATH-8841#FAKE-QUERY-8841");

    expect(response.body).toMatchObject({ detail: NOT_FOUND_DETAIL });
    expectNoRequestText(response);
  });

  it("keeps an encoded newline in the instance as plain text", async () => {
    const response = await http().get("/api/v1/a%0Ab?q=FAKE-QUERY-8841");

    expect(response.body).toMatchObject({ detail: NOT_FOUND_DETAIL, instance: "/api/v1/a%0Ab" });
    expectNoRequestText(response);
  });

  it("keeps an encoded space, which is plain text once encoded", async () => {
    const response = await http().get("/api/v1/a%20b");

    expect(response.body).toMatchObject({ detail: NOT_FOUND_DETAIL, instance: "/api/v1/a%20b" });
  });

  it("gives the fixed instance to a path Express refuses to decode", async () => {
    const response = await http().get("/api/v1/a%zz");

    expect(response.body).toMatchObject({
      status: 400,
      detail: "The request is invalid.",
      instance: "about:blank",
    });
    expectNoRequestText(response);
  });

  it("keeps a right-to-left override only in its encoded form", async () => {
    const response = await http().get("/api/v1/a%E2%80%AEb");

    expect(JSON.stringify(response.body)).not.toContain("\u202e");
    expect(response.body).toMatchObject({ instance: "/api/v1/a%E2%80%AEb" });
  });

  it("truncates a path of 10 000 characters in the instance", async () => {
    const response = await http().get(`/api/v1/${"a".repeat(10_000)}`);

    expect(response.status).toBe(404);
    expect(logs.text()).toContain("request completed");
    expect(problemDetailsSchema.parse(response.body).instance).toHaveLength(200);
    expect(JSON.stringify(response.headers).length).toBeLessThan(2000);
    expect(logs.text()).not.toContain("a".repeat(100));
  });

  it("answers a wrong method with the 404 of Nest (it has no 405 here)", async () => {
    const response = await http().post("/api/v1/health").send({ x: "SECRETBODY8841" });

    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({ detail: NOT_FOUND_DETAIL, instance: "/api/v1/health" });
    expectNoRequestText(response);
  });

  it("answers a wrong content type with a fixed 415", async () => {
    const response = await http()
      .post("/api/v1/probe/validation")
      .set("Content-Type", "application/json; charset=FAKE-QUERY-8841")
      .send("SECRETBODY8841");

    expect(response.body).toMatchObject({
      status: 415,
      detail: "The content type of the request is not supported.",
    });
    expectNoRequestText(response);
  });

  it("answers an oversized body with a fixed 413", async () => {
    const response = await http()
      .post("/api/v1/probe/validation")
      .send({ name: `SECRETBODY8841${"x".repeat(2000)}`, quantity: 1 });

    expect(response.body).toMatchObject({
      status: 413,
      detail: "The request body is too large.",
    });
    expectNoRequestText(response);
  });

  it.each([
    ["a top-level array", '["SECRETBODY8841"]', VALIDATION_TYPE],
    // The strict JSON parser refuses these two.
    ["null", "null", "about:blank"],
    ["a string", '"SECRETBODY8841"', "about:blank"],
  ])("answers %s with a fixed problem", async (_name, body, type) => {
    const response = await http()
      .post("/api/v1/probe/strict")
      .set("Content-Type", "application/json")
      .send(body);

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({ type });
    expectNoRequestText(response);
    expect(Object.hasOwn(Object.prototype, "polluted8841")).toBe(false);
  });

  it("refuses a __proto__ key nested in a record with the exact fixed problem", async () => {
    const response = await http()
      .post("/api/v1/probe/strict")
      .set("Content-Type", "application/json")
      .send('{"labels":{"__proto__":{"polluted8841":true}}}');

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      type: "about:blank",
      title: "Bad Request",
      status: 400,
      detail: "The request body is not acceptable.",
      instance: STRICT_INSTANCE,
    });
    expectNoRequestText(response);
    expect(Object.hasOwn(Object.prototype, "polluted8841")).toBe(false);
  });
});
