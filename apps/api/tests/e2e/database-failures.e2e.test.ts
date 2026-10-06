import { createServer } from "node:net";
import type { Server, Socket } from "node:net";
import { healthResponseSchema } from "@entana/contracts";
import { createPrismaClient } from "@entana/database";
import type { PrismaClient } from "@entana/database";
import type { NestExpressApplication } from "@nestjs/platform-express";
import request from "supertest";
import { afterEach, describe, expect, it } from "vitest";
import { startAppWithDatabaseProbe, startRealApp } from "./support/create-test-app.js";
import { captureLogs } from "./support/log-capture.js";
import { buildTestConfig } from "./support/test-config.js";

const PASSWORD = "s3cret-pass-word";
const DATABASE_USER = "failure-user";
const DATABASE_NAME = "failure-db";
const CONNECTION_TIMEOUT_MS = 300;
const PROBE_PATH = "/api/v1/probe/database";
const WARNING_LEVEL = 40;
// Loose on purpose (CI jitter): far above the shortened timeout, far below a default pg wait.
const MAX_ANSWER_MS = 2000;

const SERVICE_UNAVAILABLE_PROBLEM = {
  type: "about:blank",
  title: "Service Unavailable",
  status: 503,
  detail: "The service is temporarily unavailable.",
  instance: PROBE_PATH,
};

interface SilentServer {
  readonly port: number;
  close(): Promise<void>;
}

// Accepts connections and never answers: the database is "there" but hangs.
async function startSilentServer(): Promise<SilentServer> {
  const sockets = new Set<Socket>();
  const server: Server = createServer((socket) => {
    sockets.add(socket);
    socket.on("error", () => undefined);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (address === null || typeof address === "string") {
    throw new Error("The silent server is not listening on a TCP port.");
  }
  return {
    port: address.port,
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

describe("a failing database behind a route that runs a real query", () => {
  let app: NestExpressApplication | undefined;
  let silentServer: SilentServer | undefined;
  const logs = captureLogs();

  afterEach(async () => {
    // The server goes first: closing the pool waits for its connections.
    await silentServer?.close();
    await app?.close();
    app = undefined;
    silentServer = undefined;
    logs.reset();
  });

  async function startAgainst(port: number): Promise<NestExpressApplication> {
    const connectionString = databaseUrl(port);
    const config = buildTestConfig({ DATABASE_URL: connectionString, LOG_LEVEL: "info" });
    const client: PrismaClient = createPrismaClient({
      connectionString,
      connectionTimeoutMs: CONNECTION_TIMEOUT_MS,
    });
    app = await startAppWithDatabaseProbe(config, client, logs.stream);
    logs.reset();
    return app;
  }

  // Everything that identifies the database: neither the answer nor the logs may hold any of it.
  function expectNothingAboutTheDatabase(everythingSent: string, port: number): void {
    const secrets = [PASSWORD, DATABASE_USER, "127.0.0.1", String(port), DATABASE_NAME];
    for (const secret of secrets) {
      expect(everythingSent).not.toContain(secret);
      expect(logs.text()).not.toContain(secret);
    }
    // Markers of the pg and Prisma errors (the access log has its own stack, of pino-http).
    expect(logs.text()).not.toMatch(
      /terminated|ECONNREFUSED|DatabaseNotReachable|DriverAdapter|P20\d\d|SELECT/i,
    );
  }

  // The access log (it has a response time) is separate: the filter writes exactly one other line.
  function failureLines(): Record<string, unknown>[] {
    return logs.entries().filter((entry) => !("responseTime" in entry));
  }

  async function expectFixedUnavailableAnswer(
    started: NestExpressApplication,
    port: number,
    reason: string,
  ): Promise<void> {
    const startedAt = performance.now();

    const response = await request(started.getHttpServer()).get(PROBE_PATH);

    expect(performance.now() - startedAt).toBeLessThan(MAX_ANSWER_MS);
    expect(response.status).toBe(503);
    expect(response.headers["content-type"]).toMatch(/^application\/problem\+json/);
    expect(response.body).toEqual(SERVICE_UNAVAILABLE_PROBLEM);
    expectNothingAboutTheDatabase(JSON.stringify([response.body, response.headers]), port);
    expect(failureLines()).toHaveLength(1);
    // The whole line, minus the fields pino adds to every line: nothing else may be on it.
    const { time, pid, hostname, context, req, ...line } = failureLines()[0] ?? {};
    expect([typeof time, typeof pid, typeof hostname, typeof context]).toEqual([
      "number",
      "number",
      "string",
      "string",
    ]);
    // The request binding of every line: the request id and the method, nothing else.
    const binding: unknown = req;
    expect(
      typeof binding === "object" && binding !== null ? Object.keys(binding).sort() : binding,
    ).toEqual(["id", "method"]);
    expect(line).toEqual({ level: WARNING_LEVEL, reason, msg: "Database operation failed." });
  }

  it("answers the fixed 503 when nothing listens on the port", async () => {
    const port = await findClosedPort();
    const started = await startAgainst(port);

    await expectFixedUnavailableAnswer(started, port, "connection");
  });

  it("answers the same fixed 503 within the shortened timeout when the server never answers", async () => {
    silentServer = await startSilentServer();
    const started = await startAgainst(silentServer.port);

    await expectFixedUnavailableAnswer(started, silentServer.port, "timeout");
  });

  it("leaves /health at 200 and /health/ready with its own fixed 503", async () => {
    const port = await findClosedPort();
    const started = await startAgainst(port);

    const health = await request(started.getHttpServer()).get("/api/v1/health");
    const ready = await request(started.getHttpServer()).get("/api/v1/health/ready");

    expect(health.status).toBe(200);
    expect(healthResponseSchema.parse(health.body).status).toBe("ok");
    expect(ready.status).toBe(503);
    expect(ready.body).toEqual({
      type: "about:blank",
      title: "Service Unavailable",
      status: 503,
      detail: "The service is not ready.",
      instance: "/api/v1/health/ready",
    });
  });
});

describe("the test-only database route", () => {
  it("does not exist on the real application module", async () => {
    const app = await startRealApp(buildTestConfig());
    try {
      const response = await request(app.getHttpServer()).get(PROBE_PATH);

      expect(response.status).toBe(404);
      expect(response.body).toMatchObject({
        status: 404,
        title: "Not Found",
        instance: PROBE_PATH,
      });
    } finally {
      await app.close();
    }
  });
});
