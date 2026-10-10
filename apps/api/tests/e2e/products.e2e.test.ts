import { createServer } from "node:net";
import type { PrismaClient } from "@entana/database";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { productListResponseSchema, publicProductSchema } from "@entana/contracts";
import request from "supertest";
import { z } from "zod";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DATABASE_CLIENT } from "../../src/database/client-token/database-client.js";
import { startAppWithClient, startRealApp } from "./support/create-test-app.js";
import { captureLogs } from "./support/log-capture.js";
import type { LogCapture } from "./support/log-capture.js";
import { buildTestConfig } from "./support/test-config.js";

const PRODUCTS_PATH = "/api/v1/products";
const PASSWORD = "s3cret-pass-word";
const DATABASE_USER = "products-user";
const DATABASE_NAME = "products-db";
const ERROR_LEVEL = 50;
const SETTLE_MS = 200;

const GENERIC_PROBLEM = {
  type: "about:blank",
  title: "Internal Server Error",
  status: 500,
  detail: "An unexpected error occurred.",
  instance: PRODUCTS_PATH,
};

const openApiSchema = z.object({
  paths: z.record(
    z.string(),
    z.object({ get: z.object({ responses: z.record(z.string(), z.unknown()) }).optional() }),
  ),
});

// The line of the exception filter for the typed error: its type and its stack frames.
function failureLinesOf(logs: LogCapture): Record<string, unknown>[] {
  return logs
    .entries()
    .filter((entry) => String(entry.msg).startsWith("IncompleteActiveProductError"));
}

// The line written for a classified database failure: a fixed message and the kind as `reason`.
function databaseFailureLines(logs: LogCapture): Record<string, unknown>[] {
  return logs.entries().filter((entry) => entry.msg === "Database operation failed.");
}

// A port nobody listens on: it was free a moment ago, and it is closed again.
async function findClosedPort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  await new Promise<void>((resolve) => {
    server.close(() => {
      resolve();
    });
  });
  if (address === null || typeof address === "string") throw new Error("No port was assigned.");
  return address.port;
}

describe("GET /api/v1/products, without a database", () => {
  let app: NestExpressApplication | undefined;
  // One capture and one log level for every application of this file: nestjs-pino keeps the logger
  // of the first application created in the process, so a first application that is silent would
  // silence the logs of all the others.
  const logs = captureLogs();

  beforeEach(() => {
    logs.reset();
  });

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  it("builds one database client for the whole application, and closes it once", async () => {
    app = await startRealApp(buildTestConfig({ LOG_LEVEL: "info" }), logs.stream);

    const clients = app.get<PrismaClient>(DATABASE_CLIENT, { each: true });
    const [client] = clients;
    if (client === undefined) throw new Error("The application has no database client.");
    const disconnect = vi.spyOn(client, "$disconnect");
    await app.close();
    app = undefined;

    expect(clients.length).toBe(1);
    expect(disconnect).toHaveBeenCalledOnce();
  });

  it("answers 200 with a short public cache on a success, whatever the database behind it", async () => {
    const row = {
      id: "0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b",
      name: "Zebu skewers",
      description: null,
      priceAr: 12000,
      available: true,
      imageKey: "zebu.jpg",
      imageAlt: "Skewers",
    };
    // Only the client is replaced: the route, the service, the mapper and the filter are the real ones.
    const client = {
      product: { findMany: () => Promise.resolve([row]) },
      $disconnect: () => undefined,
    };
    app = await startAppWithClient(buildTestConfig({ LOG_LEVEL: "info" }), client, logs.stream);

    const response = await request(app.getHttpServer()).get(PRODUCTS_PATH);

    expect(response.status).toBe(200);
    expect(response.headers["cache-control"]).toBe("public, max-age=30");
    expect(productListResponseSchema.parse(response.body).products).toHaveLength(1);
  });

  it("does not let a shared cache keep the answer for an unknown route", async () => {
    app = await startRealApp(buildTestConfig({ LOG_LEVEL: "info" }), logs.stream);

    const response = await request(app.getHttpServer()).get("/api/v1/nothing-here");

    expect(response.status).toBe(404);
    expect(response.headers["cache-control"]).toBe("no-store");
  });

  it("answers the fixed 503 when the database is unreachable, and logs nothing about it", async () => {
    const port = await findClosedPort();
    const url = `postgresql://${DATABASE_USER}:${PASSWORD}@127.0.0.1:${String(port)}/${DATABASE_NAME}`;
    app = await startRealApp(
      buildTestConfig({ DATABASE_URL: url, LOG_LEVEL: "info" }),
      logs.stream,
    );
    logs.reset();

    const response = await request(app.getHttpServer()).get(PRODUCTS_PATH);

    expect(response.status).toBe(503);
    expect(response.headers["content-type"]).toMatch(/^application\/problem\+json/);
    expect(response.body).toEqual({
      type: "about:blank",
      title: "Service Unavailable",
      status: 503,
      detail: "The service is temporarily unavailable.",
      instance: PRODUCTS_PATH,
    });
    expect(response.headers["cache-control"]).toBe("no-store");
    // Positive control: the logs of this request exist, so their silence about the database means
    // something. They are written a moment after the answer.
    await vi.waitFor(() => {
      expect(logs.text()).toContain("request errored");
    });
    // The port is looked for with its host: a bare five-digit number could match a timestamp.
    const secrets = [PASSWORD, DATABASE_USER, `127.0.0.1:${String(port)}`, DATABASE_NAME];
    for (const secret of secrets) {
      expect(JSON.stringify([response.body, response.headers])).not.toContain(secret);
      expect(logs.text()).not.toContain(secret);
    }
  });

  // A deployed application connects through a host name, which can resolve to ::1 and 127.0.0.1:
  // the raw error is not asserted, only what the client and the logs get.
  it("answers the same fixed 503 when the host is localhost and nothing listens, with one failure line", async () => {
    const port = await findClosedPort();
    const url = `postgresql://${DATABASE_USER}:${PASSWORD}@localhost:${String(port)}/${DATABASE_NAME}`;
    app = await startRealApp(
      buildTestConfig({ DATABASE_URL: url, LOG_LEVEL: "info" }),
      logs.stream,
    );
    logs.reset();

    const response = await request(app.getHttpServer()).get(PRODUCTS_PATH);

    expect(response.status).toBe(503);
    expect(response.headers["content-type"]).toMatch(/^application\/problem\+json/);
    expect(response.body).toEqual({
      type: "about:blank",
      title: "Service Unavailable",
      status: 503,
      detail: "The service is temporarily unavailable.",
      instance: PRODUCTS_PATH,
    });
    await vi.waitFor(() => {
      expect(databaseFailureLines(logs).length).toBeGreaterThan(0);
    });
    // Let a second line, if there were one, arrive before counting: the claim is "exactly one".
    await new Promise((resolve) => setTimeout(resolve, SETTLE_MS));
    expect(databaseFailureLines(logs)).toHaveLength(1);
    expect(databaseFailureLines(logs)[0]).toMatchObject({ reason: "connection" });
    const secrets = [PASSWORD, DATABASE_USER, `localhost:${String(port)}`, DATABASE_NAME];
    for (const secret of secrets) {
      expect(JSON.stringify([response.body, response.headers])).not.toContain(secret);
      expect(logs.text()).not.toContain(secret);
    }
  });

  describe("when an active row has no photo (the CHECK makes this impossible in a real database)", () => {
    const rowId = "0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b";
    const rowName = "Distinctive product name 7f3a";

    // Only the client is replaced, with the answer a broken database would give: the service and the
    // mapper are the real ones, so the real typed error reaches the real exception filter.
    function clientReturningRowWithoutPhoto(): unknown {
      const row = {
        id: rowId,
        name: rowName,
        description: null,
        priceAr: 1000,
        available: true,
        imageKey: null,
        imageAlt: null,
      };
      return { product: { findMany: () => Promise.resolve([row]) }, $disconnect: () => undefined };
    }

    it("answers the same generic 500 as any unknown error, with no row data", async () => {
      const config = buildTestConfig({ LOG_LEVEL: "info" });
      app = await startAppWithClient(config, clientReturningRowWithoutPhoto(), logs.stream);
      logs.reset();

      const response = await request(app.getHttpServer()).get(PRODUCTS_PATH);

      expect(response.status).toBe(500);
      expect(response.headers["content-type"]).toMatch(/^application\/problem\+json/);
      expect(response.body).toEqual(GENERIC_PROBLEM);
      expect(response.headers["cache-control"]).toBe("no-store");
      expect(JSON.stringify([response.body, response.headers])).not.toContain(rowName);
      // Let the logs of this request land before the next test starts its own capture.
      await vi.waitFor(() => {
        expect(logs.text()).toContain("request errored");
      });
    });

    it("logs the type of the error and its stack frames, never the row", async () => {
      const config = buildTestConfig({ LOG_LEVEL: "info" });
      app = await startAppWithClient(config, clientReturningRowWithoutPhoto(), logs.stream);
      logs.reset();

      await request(app.getHttpServer()).get(PRODUCTS_PATH);

      // The logs are written a moment after the answer is sent.
      await vi.waitFor(() => {
        expect(failureLinesOf(logs)).toHaveLength(1);
      });
      expect(String(failureLinesOf(logs)[0]?.msg)).toMatch(/^IncompleteActiveProductError\n\s+at /);
      expect(failureLinesOf(logs)[0]?.level).toBe(ERROR_LEVEL);
      expect(logs.text()).not.toContain(rowName);
      expect(logs.text()).not.toContain(rowId);
    });
  });

  describe("when an active row has an image key that is not a plain file name", () => {
    const badKey = "products/secret-key-4d2c.jpg";

    it("answers the generic 500, with no key in the body or the logs", async () => {
      const row = {
        id: "0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b",
        name: "Zebu skewers",
        description: null,
        priceAr: 1000,
        available: true,
        imageKey: badKey,
        imageAlt: "Skewers",
      };
      const client = {
        product: { findMany: () => Promise.resolve([row]) },
        $disconnect: () => undefined,
      };
      app = await startAppWithClient(buildTestConfig({ LOG_LEVEL: "info" }), client, logs.stream);
      logs.reset();

      const response = await request(app.getHttpServer()).get(PRODUCTS_PATH);

      expect(response.status).toBe(500);
      expect(response.body).toEqual(GENERIC_PROBLEM);
      await vi.waitFor(() => {
        expect(logs.text()).toContain("InvalidProductImageKeyError");
      });
      expect(logs.text()).not.toContain("secret-key-4d2c");
    });
  });

  describe("OpenAPI document", () => {
    async function readDocument(): Promise<Record<string, unknown>> {
      app = await startRealApp(buildTestConfig({ LOG_LEVEL: "info" }), logs.stream);
      const response = await request(app.getHttpServer()).get("/api/docs-json");
      return z.record(z.string(), z.unknown()).parse(response.body);
    }

    function responsesOf(document: Record<string, unknown>, path: string): Record<string, unknown> {
      return openApiSchema.parse(document).paths[path]?.get?.responses ?? {};
    }

    it("documents the route with its 200, 500 and 503 answers, like the health routes", async () => {
      const document = await readDocument();

      const responses = responsesOf(document, PRODUCTS_PATH);
      const readiness = responsesOf(document, "/api/v1/health/ready");
      expect(Object.keys(responses)).toEqual(
        expect.arrayContaining(["200", "500", "503", "default"]),
      );
      // The problem answers are the same schema as the one the health routes document.
      expect(responses["503"]).toEqual({
        ...z.record(z.string(), z.unknown()).parse(readiness["503"]),
        description: "The database is unreachable. The body names no host.",
      });
      expect(responses.default).toEqual(readiness.default);
    });

    it("describes the 200 response with the keys of the shared schema, and mentions no sku", async () => {
      const document = await readDocument();

      const ok = responsesOf(document, PRODUCTS_PATH)["200"];
      const schema = z
        .object({
          content: z.object({
            "application/json": z.object({
              schema: z.object({
                properties: z.object({
                  products: z.object({
                    items: z.object({
                      properties: z.record(z.string(), z.unknown()),
                      required: z.array(z.string()),
                      additionalProperties: z.literal(false),
                    }),
                  }),
                }),
              }),
            }),
          }),
        })
        .parse(ok).content["application/json"].schema.properties.products.items;
      const contractKeys = Object.keys(publicProductSchema.shape).sort();
      expect(Object.keys(schema.properties).sort()).toEqual(contractKeys);
      expect([...schema.required].sort()).toEqual(contractKeys);
      // The whole generated document, every route and every example: the word appears nowhere.
      expect(JSON.stringify(document)).not.toContain("sku");
    });
  });
});
