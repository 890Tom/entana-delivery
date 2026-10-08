import { problemDetailsSchema } from "@entana/contracts";
import type { FieldError } from "@entana/contracts";
import type { NestExpressApplication } from "@nestjs/platform-express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { VALIDATION_DETAILS } from "../../src/errors/request-validation-error.js";
import { startAppWithProbe, startRealApp } from "./support/create-test-app.js";
import { captureLogs } from "./support/log-capture.js";
import { buildTestConfig } from "./support/test-config.js";

const STRICT_PATH = "/api/v1/probe/strict";
const SAFE_POINTER = /^(\/[A-Za-z][A-Za-z0-9]{0,40}|\/(0|[1-9][0-9]{0,2}))*$/;
const MAX_REPORTED_ERRORS = 20;
const HOSTILE_KEY = "FAKE-KEY-8841";
const HOSTILE_VALUES = [
  HOSTILE_KEY,
  "x".repeat(10_000),
  "line1\nline2-SECRETLINE",
  "<script>alert(8841)</script>",
  "‮gnp.exe-RLO8841",
  "__proto__",
];

const VALID = {
  name: "abc",
  count: 2,
  kind: "a",
  choice: "z",
  code: "ok",
  tags: [{ label: "t" }],
  labels: { k: 1 },
};

describe("validation errors carry no text of the request", () => {
  let app: NestExpressApplication;
  const logs = captureLogs();

  beforeAll(async () => {
    app = await startAppWithProbe(
      buildTestConfig({ BODY_LIMIT_KB: "512", LOG_LEVEL: "trace" }),
      logs.stream,
    );
  });
  afterAll(async () => {
    await app.close();
  });

  async function post(body: unknown): Promise<request.Response> {
    return request(app.getHttpServer())
      .post(STRICT_PATH)
      .set("Content-Type", "application/json")
      .send(typeof body === "string" ? body : JSON.stringify(body));
  }

  function errorsOf(response: request.Response): readonly FieldError[] {
    return problemDetailsSchema.parse(response.body).errors ?? [];
  }

  function expectSafe(response: request.Response, hostile: readonly string[]): void {
    const problem = problemDetailsSchema.parse(response.body);
    const everything = JSON.stringify(response.body) + JSON.stringify(response.headers);
    for (const text of hostile) {
      expect(everything).not.toContain(text);
      expect(logs.text()).not.toContain(text);
    }
    expect(problem.errors?.length ?? 0).toBeLessThanOrEqual(MAX_REPORTED_ERRORS);
    for (const error of problem.errors ?? []) {
      expect(error.pointer).toMatch(SAFE_POINTER);
      expect(Object.values(VALIDATION_DETAILS)).toContain(error.detail);
    }
  }

  it("accepts a valid body", async () => {
    expect((await post(VALID)).status).toBe(201);
  });

  it.each(HOSTILE_VALUES)("never repeats an unknown key (%#)", async (key) => {
    const response = await post(`{"${JSON.stringify(key).slice(1, -1)}":1,"name":"abc"}`);

    expect(response.status).toBe(400);
    expectSafe(response, [key.slice(0, 40), HOSTILE_KEY]);
    // The global pipe drops a "__proto__" key before validating, so that one is not unknown.
    if (key !== "__proto__") {
      expect(errorsOf(response)).toContainEqual({
        pointer: "",
        detail: VALIDATION_DETAILS.unrecognized_keys,
      });
    }
  });

  it.each(HOSTILE_VALUES)("never repeats a hostile value of any type (%#)", async (value) => {
    const response = await post({
      name: value,
      count: value,
      kind: value,
      choice: [value],
      code: value,
      tags: [{ label: "", extra: value }, value],
      labels: { k: value },
      email: value,
    });

    expect(response.status).toBe(400);
    expectSafe(response, [value.slice(0, 40), "secret-refine"]);
  });

  it("maps each kind of failure to its own fixed detail", async () => {
    const response = await post({
      name: "x",
      count: 99,
      kind: "zz",
      choice: true,
      code: "nope",
      tags: [],
      labels: {},
      email: "not-an-email",
    });
    const details = new Map<string, string>(errorsOf(response).map((e) => [e.pointer, e.detail]));

    expect(details.get("/name")).toBe(VALIDATION_DETAILS.too_small);
    expect(details.get("/count")).toBe(VALIDATION_DETAILS.too_big);
    expect(details.get("/kind")).toBe(VALIDATION_DETAILS.invalid_value);
    expect(details.get("/choice")).toBe(VALIDATION_DETAILS.default);
    expect(details.get("/code")).toBe(VALIDATION_DETAILS.custom);
    expect(details.get("/email")).toBe(VALIDATION_DETAILS.invalid_format);
    expect(errorsOf(await post({ ...VALID, name: 5 }))).toEqual([
      { pointer: "/name", detail: VALIDATION_DETAILS.invalid_type },
    ]);
  });

  it("stops the pointer at the parent of a record key chosen by the client", async () => {
    const response = await post({ ...VALID, labels: { [HOSTILE_KEY]: "v", "a/b": "v" } });

    expect(errorsOf(response)).toContainEqual({
      pointer: "/labels",
      detail: VALIDATION_DETAILS.invalid_type,
    });
    expectSafe(response, [HOSTILE_KEY]);
  });

  it("keeps a record key that has the safe shape", async () => {
    const response = await post({ ...VALID, labels: { safeKey1: "v" } });

    expect(errorsOf(response)).toEqual([
      { pointer: "/labels/safeKey1", detail: VALIDATION_DETAILS.invalid_type },
    ]);
  });

  it("stops the pointer at a deep nesting it does not accept", async () => {
    const response = await post({ ...VALID, labels: { a: { b: { c: { d: 1 } } } } });

    expect(response.status).toBe(400);
    expect(errorsOf(response)).toEqual([
      { pointer: "/labels/a", detail: VALIDATION_DETAILS.invalid_type },
    ]);
    expectSafe(response, []);
  });

  it("caps the number of errors and the size of the response", async () => {
    const labels = Object.fromEntries(
      Array.from({ length: 5000 }, (_, index) => [`k${String(index)}`, "text"]),
    );
    const response = await post({ ...VALID, labels });

    expect(response.status).toBe(400);
    expect(errorsOf(response)).toHaveLength(MAX_REPORTED_ERRORS);
    expect(JSON.stringify(response.body).length).toBeLessThan(4000);
    expectSafe(response, []);
  });

  it("does not pollute prototypes through a __proto__ key", async () => {
    const response = await post(
      '{"__proto__":{"polluted8841":true},"constructor":{"prototype":{"p":1}}}',
    );

    expect(response.status).toBe(400);
    expect("polluted8841" in {}).toBe(false);
    expect("p" in {}).toBe(false);
  });
});

describe("the real application module", () => {
  it("has no test-only validation route", async () => {
    const real = await startRealApp(buildTestConfig());
    try {
      expect((await request(real.getHttpServer()).post(STRICT_PATH).send({})).status).toBe(404);
    } finally {
      await real.close();
    }
  });
});
