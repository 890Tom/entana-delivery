import type { NestExpressApplication } from "@nestjs/platform-express";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AppModule } from "../../src/app.module.js";
import { NEST_APPLICATION_OPTIONS, configureApplication } from "../../src/configure-application.js";
import { AdminProbeModule } from "./support/admin-probe.module.js";
import { ADMIN_TEST_ORIGIN, buildTestConfig } from "./support/test-config.js";

const PROBE_PATH = "/api/v1/admin/probe";
const LOGIN_PATH = "/api/v1/admin/auth/login";
const REACHED = "admin-probe-was-reached";

interface Document {
  readonly paths: Record<string, Record<string, { responses: Record<string, unknown> }>>;
  readonly components: { securitySchemes: Record<string, unknown> };
}

describe("the administration over HTTP, without a database", () => {
  let app: NestExpressApplication;
  let nextAddress = 0;

  // Each test its own address: the limit of the login is counted per address.
  const address = (): string => {
    nextAddress += 1;
    return `203.0.113.${String(nextAddress)}`;
  };
  const server = (): ReturnType<typeof request> => request(app.getHttpServer());

  beforeAll(async () => {
    const config = buildTestConfig({ TRUST_PROXY: "1", ADMIN_COOKIE_SECURE: "true" });
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule.register(config), AdminProbeModule],
    }).compile();
    app = moduleRef.createNestApplication<NestExpressApplication>({ ...NEST_APPLICATION_OPTIONS });
    configureApplication(app, config);
    await app.listen(0, "127.0.0.1");
  });
  afterAll(async () => {
    await app.close();
  });

  describe("a route that says nothing about itself", () => {
    it("is closed without a session, with the fixed 401", async () => {
      const response = await server().get(PROBE_PATH).set("X-Forwarded-For", address());

      expect(response.status).toBe(401);
      expect(response.headers["content-type"]).toContain("application/problem+json");
      expect(response.body).toEqual({
        type: "about:blank",
        title: "Unauthorized",
        status: 401,
        detail: "Authentication is required.",
        instance: PROBE_PATH,
      });
    });

    it.each([
      ["a capital letter", "/api/v1/Admin/probe"],
      ["upper case", "/API/V1/ADMIN/PROBE"],
      ["a trailing slash", "/api/v1/admin/probe/"],
      ["a doubled slash", "/api/v1//admin/probe"],
      ["a leading doubled slash", "//api/v1/admin/probe"],
      ["an encoded letter", "/api/v1/%61dmin/probe"],
      ["an encoded slash", "/api/v1/admin%2Fprobe"],
      ["a query string", "/api/v1/admin/probe?x=1"],
    ])("is never served without a session, written with %s", async (_label, path) => {
      const response = await server().get(path).set("X-Forwarded-For", address());

      // 401 from the guard, or 404 when the router does not take that spelling for the route:
      // never the route's own answer.
      expect([401, 404]).toContain(response.status);
      expect(response.text).not.toContain(REACHED);
    });
  });

  describe("a request that changes something", () => {
    it("is refused from another origin with a 403, even to log in", async () => {
      const response = await server()
        .post(LOGIN_PATH)
        .set("X-Forwarded-For", address())
        .set("Origin", "https://evil.example")
        .send({ email: "admin@example.mg", password: "x" });

      expect(response.status).toBe(403);
      expect(response.body).toMatchObject({ status: 403, detail: "This action is not allowed." });
    });

    it("is refused without an Origin when the session cookie is sent", async () => {
      const response = await server()
        .post(PROBE_PATH)
        .set("X-Forwarded-For", address())
        .set("Cookie", `__Host-admin_session=${"A".repeat(43)}`);

      expect(response.status).toBe(403);
    });

    it("reaches the guard when the origin is allowed", async () => {
      const response = await server()
        .post(PROBE_PATH)
        .set("X-Forwarded-For", address())
        .set("Origin", ADMIN_TEST_ORIGIN);

      expect(response.status).toBe(401);
    });
  });

  describe("the login", () => {
    it("refuses an invalid body with a 400 that does not repeat what was sent", async () => {
      const response = await server()
        .post(LOGIN_PATH)
        .set("X-Forwarded-For", address())
        .send({ email: "not an address", password: "my-private-password" });

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({ errors: [{ pointer: "/email" }] });
      expect(response.text).not.toContain("my-private-password");
      expect(response.text).not.toContain("not an address");
    });

    it("refuses a body that is not JSON with a 415", async () => {
      const response = await server()
        .post(LOGIN_PATH)
        .set("X-Forwarded-For", address())
        .type("text/plain")
        .send("email=admin@example.mg");

      expect(response.status).toBe(415);
    });

    it("answers 429 with Retry-After from the 11th attempt of one address, whatever the outcome", async () => {
      const from = address();
      const attempts = [];
      for (let attempt = 0; attempt < 11; attempt += 1) {
        attempts.push(await server().post(LOGIN_PATH).set("X-Forwarded-For", from).send({}));
      }

      expect(attempts.slice(0, 10).map((response) => response.status)).toEqual(Array(10).fill(400));
      const limited = attempts[10];
      expect(limited?.status).toBe(429);
      expect(limited?.headers["retry-after"]).toBe("600");
      expect(limited?.body).toMatchObject({
        status: 429,
        detail: "Too many requests. Try again later.",
      });
    });
  });

  describe("the OpenAPI document", () => {
    let document: Document;
    let documentText: string;

    beforeAll(async () => {
      documentText = (await server().get("/api/docs-json")).text;
      document = JSON.parse(documentText) as Document;
    });

    it.each([
      ["/api/v1/admin/auth/login", "post", ["200", "400", "401", "403", "415", "429"]],
      ["/api/v1/admin/auth/logout", "post", ["200", "403"]],
      ["/api/v1/admin/auth/me", "get", ["200", "401"]],
    ] as const)("documents %s", (path, method, statuses) => {
      const operation = document.paths[path]?.[method];

      expect(Object.keys(operation?.responses ?? {})).toEqual(
        expect.arrayContaining([...statuses]),
      );
    });

    it("declares the session as a cookie, and asks for it on /me only", () => {
      expect(document.components.securitySchemes).toMatchObject({
        adminSession: { type: "apiKey", in: "cookie", name: "__Host-admin_session" },
      });
      expect(document.paths["/api/v1/admin/auth/me"]?.get).toHaveProperty("security");
      expect(document.paths["/api/v1/admin/auth/login"]?.post).not.toHaveProperty("security");
    });

    it("uses fake values only", () => {
      expect(documentText).toContain("admin@example.mg");
    });
  });
});
