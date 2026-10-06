import { createServer } from "node:net";
import type { Server, Socket } from "node:net";
import {
  healthResponseSchema,
  problemDetailsSchema,
  readinessResponseSchema,
} from "@entana/contracts";
import type { NestExpressApplication } from "@nestjs/platform-express";
import type { PrismaClient } from "@entana/database";
import request from "supertest";
import { z } from "zod";
import type { Response } from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DATABASE_CLIENT } from "../../src/database/database-client.js";
import { startAppWithReadinessTimeout } from "./support/create-test-app.js";
import { captureLogs } from "./support/log-capture.js";
import type { LogCapture } from "./support/log-capture.js";
import { buildTestConfig } from "./support/test-config.js";

const PASSWORD = "s3cret-pass-word";
const DATABASE_USER = "readiness-user";
const DATABASE_NAME = "readiness-db";
const READINESS_TIMEOUT_MS = 300;
const READY_PATH = "/api/v1/health/ready";
const WARNING_LEVEL = 40;

const openApiSchema = z.object({
  paths: z.record(
    z.string(),
    z.object({ get: z.object({ responses: z.record(z.string(), z.unknown()) }).optional() }),
  ),
});

const NOT_READY_PROBLEM = {
  type: "about:blank",
  title: "Service Unavailable",
  status: 503,
  detail: "The service is not ready.",
  instance: READY_PATH,
};

// A server that accepts connections and never answers: the database is "there" but hangs.
interface SilentServer {
  readonly port: number;
  /** How many connections the server has accepted so far. */
  connectionCount(): number;
  close(): Promise<void>;
}

async function startSilentServer(): Promise<SilentServer> {
  const sockets = new Set<Socket>();
  let accepted = 0;
  const server: Server = createServer((socket) => {
    accepted += 1;
    sockets.add(socket);
    socket.on("error", () => undefined);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (address === null || typeof address === "string") {
    throw new Error("The silent server is not listening on a TCP port.");
  }
  const { port } = address;
  return {
    port,
    connectionCount: () => accepted,
    close: async () => {
      for (const socket of sockets) {
        socket.destroy();
      }
      await new Promise<void>((resolve) =>
        server.close(() => {
          resolve();
        }),
      );
    },
  };
}

// A port nobody listens on: it was free a moment ago, and it is closed again.
async function findClosedPort(): Promise<number> {
  const server = await startSilentServer();
  await server.close();
  return server.port;
}

function databaseUrl(port: number): string {
  return `postgresql://${DATABASE_USER}:${PASSWORD}@127.0.0.1:${String(port)}/${DATABASE_NAME}`;
}

describe("GET /api/v1/health/ready with a database that does not answer", () => {
  let app: NestExpressApplication | undefined;
  let silentServer: SilentServer | undefined;
  const logs: LogCapture = captureLogs();

  afterEach(async () => {
    // The server goes first: closing the pool waits for its connections.
    await silentServer?.close();
    await app?.close();
    app = undefined;
    silentServer = undefined;
    logs.reset();
  });

  async function startAgainst(port: number): Promise<NestExpressApplication> {
    const config = buildTestConfig({ DATABASE_URL: databaseUrl(port), LOG_LEVEL: "info" });
    app = await startAppWithReadinessTimeout(config, READINESS_TIMEOUT_MS, logs.stream);
    logs.reset();
    return app;
  }

  function readinessWarnings(): Record<string, unknown>[] {
    return logs.entries().filter((entry) => entry.level === WARNING_LEVEL);
  }

  // Everything that identifies the database: neither the answer nor the logs may hold any of it.
  function expectNothingAboutTheDatabase(response: Response, port: number): void {
    const secrets = [PASSWORD, DATABASE_USER, "127.0.0.1", String(port), DATABASE_NAME];
    const everythingSent = JSON.stringify([response.body, response.headers]);
    for (const secret of secrets) {
      expect(everythingSent).not.toContain(secret);
      expect(logs.text()).not.toContain(secret);
    }
    expect(everythingSent.toLowerCase()).not.toContain("database");
    expect(everythingSent.toLowerCase()).not.toContain("postgres");
  }

  // The access log of the 503 is the only line allowed at error level: the readiness warning is
  // one line, and nothing else (a stack, an error report) may follow it.
  function expectOnlyTheWarningAndTheAccessLog(): void {
    const others = logs.entries().filter((entry) => !("responseTime" in entry));
    expect(others).toHaveLength(1);
    expect(others[0]).toMatchObject({ level: WARNING_LEVEL, msg: "Readiness check failed." });
  }

  it("answers 503 problem+json with fixed content when nothing listens on the port", async () => {
    const port = await findClosedPort();
    const started = await startAgainst(port);

    const response = await request(started.getHttpServer()).get(READY_PATH);

    expect(response.status).toBe(503);
    expect(response.headers["content-type"]).toMatch(/^application\/problem\+json/);
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(problemDetailsSchema.parse(response.body)).toEqual(NOT_READY_PROBLEM);
    expectNothingAboutTheDatabase(response, port);
  });

  it("logs one warning with the reason connection and nothing from the error", async () => {
    const port = await findClosedPort();
    const started = await startAgainst(port);

    const response = await request(started.getHttpServer()).get(READY_PATH);

    expectNothingAboutTheDatabase(response, port);
    expectOnlyTheWarningAndTheAccessLog();
    const warnings = readinessWarnings();
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatchObject({ msg: "Readiness check failed.", reason: "connection" });
    // Nothing copied from the error: no message, no stack, no serialized error.
    for (const key of ["err", "error", "stack", "message", "cause"]) {
      expect(warnings[0]).not.toHaveProperty(key);
    }
  });

  it("answers 503 within the timeout when the server accepts and never answers", async () => {
    silentServer = await startSilentServer();
    const started = await startAgainst(silentServer.port);
    const startedAt = performance.now();

    const response = await request(started.getHttpServer()).get(READY_PATH);

    const elapsedMs = performance.now() - startedAt;
    expect(response.status).toBe(503);
    expect(response.headers["content-type"]).toMatch(/^application\/problem\+json/);
    expect(problemDetailsSchema.parse(response.body)).toEqual(NOT_READY_PROBLEM);
    expect(elapsedMs).toBeGreaterThanOrEqual(READINESS_TIMEOUT_MS - 50);
    // Far below the default of 2 seconds: it is the shortened timeout that fired.
    expect(elapsedMs).toBeLessThan(1500);
    expect(response.headers["cache-control"]).toBe("no-store");
    expectNothingAboutTheDatabase(response, silentServer.port);
    expectOnlyTheWarningAndTheAccessLog();
    expect(readinessWarnings()).toMatchObject([{ reason: "timeout" }]);
  });

  it("opens at most one connection for ten parallel requests to a server that never answers", async () => {
    silentServer = await startSilentServer();
    const started = await startAgainst(silentServer.port);

    const responses = await Promise.all(
      Array.from({ length: 10 }, () => request(started.getHttpServer()).get(READY_PATH)),
    );

    for (const response of responses) {
      expect(response.status).toBe(503);
      expect(response.headers["content-type"]).toMatch(/^application\/problem\+json/);
      expect(problemDetailsSchema.parse(response.body)).toEqual(NOT_READY_PROBLEM);
    }
    expect(silentServer.connectionCount()).toBe(1);
  });

  it("opens no second connection for a request sent after the first timeout", async () => {
    silentServer = await startSilentServer();
    const started = await startAgainst(silentServer.port);
    await request(started.getHttpServer()).get(READY_PATH);
    expect(silentServer.connectionCount()).toBe(1);

    // The first connection is still open, and so is the query waiting on it.
    const response = await request(started.getHttpServer()).get(READY_PATH);

    expect(response.status).toBe(503);
    expect(silentServer.connectionCount()).toBe(1);
  });

  it("keeps GET /api/v1/health at 200 when nothing listens on the port", async () => {
    const started = await startAgainst(await findClosedPort());

    const response = await request(started.getHttpServer()).get("/api/v1/health");

    expect(response.status).toBe(200);
    expect(healthResponseSchema.parse(response.body).status).toBe("ok");
  });

  it("keeps GET /api/v1/health at 200 when the server never answers", async () => {
    silentServer = await startSilentServer();
    const started = await startAgainst(silentServer.port);

    const response = await request(started.getHttpServer()).get("/api/v1/health");

    expect(response.status).toBe(200);
    expect(healthResponseSchema.parse(response.body).status).toBe("ok");
    expect(readinessWarnings()).toHaveLength(0);
  });

  it("asks the one database client of the application, and answers 200 when it answers", async () => {
    const started = await startAgainst(await findClosedPort());
    // The database is an external boundary: only its answer is replaced, the wiring is real.
    const query = vi
      .spyOn(started.get<PrismaClient>(DATABASE_CLIENT), "$queryRaw")
      .mockResolvedValue([{ "?column?": 1 }]);

    const response = await request(started.getHttpServer()).get(READY_PATH);

    expect(query).toHaveBeenCalledOnce();
    expect(query.mock.calls[0]?.[0]).toEqual(["SELECT 1"]);
    expect(response.status).toBe(200);
    expect(readinessResponseSchema.parse(response.body)).toEqual({ status: "ready" });
    expect(response.headers["cache-control"]).toBe("no-store");
  });

  it("is documented in OpenAPI with its 200 and 503 answers", async () => {
    const started = await startAgainst(await findClosedPort());

    const document = await request(started.getHttpServer()).get("/api/docs-json");

    const responses = openApiSchema.parse(document.body).paths[READY_PATH]?.get?.responses ?? {};
    expect(Object.keys(responses)).toEqual(expect.arrayContaining(["200", "503"]));
  });
});
