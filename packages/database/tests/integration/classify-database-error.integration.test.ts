import { randomInt, randomUUID } from "node:crypto";
import net from "node:net";
import { Client } from "pg";
import { describe, expect, inject, it, vi } from "vitest";

import { classifyDatabaseError } from "../../src/error-classification/classify-database-error.ts";
import type { DatabaseErrorKind } from "../../src/error-classification/classify-database-error.ts";
import { createPrismaClient } from "../../src/client/create-prisma-client.ts";
import type { PrismaClient } from "../../src/generated/client.ts";
import type { DatabaseClientOptions } from "../../src/client/pool-settings.ts";
import { assertThrowawayDatabase } from "../support/throwaway-database/assert-throwaway-database.ts";

// These tests are the check of the header of classify-database-error.ts: when Prisma or pg is
// upgraded, a failure here means an observed error shape has changed and the classifier must be
// revisited. A failure only ever shows kinds, never the raw error.

type Outcome = DatabaseErrorKind | "no error";

// Each call opens its own client and always closes it.
async function classifyFailureOf(
  connectionString: string,
  action: (client: PrismaClient) => Promise<unknown>,
  options: Omit<DatabaseClientOptions, "connectionString"> = {},
): Promise<Outcome> {
  const client = createPrismaClient({ connectionString, ...options });
  try {
    await action(client);
    return "no error";
  } catch (error) {
    return classifyDatabaseError(error);
  } finally {
    await client.$disconnect();
  }
}

// For the cases that really reach the database: the connection is to the throwaway database of
// the run, and the guard runs before the statement (some of them write).
function classifyFailureOnThrowaway(
  action: (client: PrismaClient) => Promise<unknown>,
): Promise<Outcome> {
  return classifyFailureOf(inject("throwawayConnectionString"), async (client) => {
    await assertThrowawayDatabase(client);
    return action(client);
  });
}

function uniquePhone(): string {
  return `+2613${String(randomInt(100_000_000)).padStart(8, "0")}`;
}

async function findClosedPort(): Promise<number> {
  const server = net.createServer();
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

describe("classifyDatabaseError (real PostgreSQL, Prisma client from createPrismaClient)", () => {
  it("gives unique_violation for the same customer phone twice", async () => {
    const phoneE164 = uniquePhone();

    const outcome = await classifyFailureOnThrowaway(async (client) => {
      await client.customer.create({ data: { phoneE164 } });
      await client.customer.create({ data: { phoneE164 } });
    });

    expect(outcome).toBe("unique_violation");
  });

  it("gives unique_violation for a duplicate phone inside an interactive transaction", async () => {
    const phoneE164 = uniquePhone();

    const outcome = await classifyFailureOnThrowaway((client) =>
      client.$transaction(async (transaction) => {
        await transaction.customer.create({ data: { phoneE164 } });
        await transaction.customer.create({ data: { phoneE164 } });
      }),
    );

    expect(outcome).toBe("unique_violation");
  });

  it("gives foreign_key_violation for an order item that points to unknown ids", async () => {
    const outcome = await classifyFailureOnThrowaway((client) =>
      client.orderItem.create({
        data: {
          orderId: randomUUID(),
          productId: randomUUID(),
          productName: "Test product",
          qty: 1,
          unitPrice: 1000,
        },
      }),
    );

    expect(outcome).toBe("foreign_key_violation");
  });

  it("gives check_violation for a customer with an invalid phone number", async () => {
    const outcome = await classifyFailureOnThrowaway((client) =>
      client.customer.create({ data: { phoneE164: "not-a-phone-number" } }),
    );

    expect(outcome).toBe("check_violation");
  });

  it("gives not_null_violation when a required column is omitted (raw SQL)", async () => {
    const outcome = await classifyFailureOnThrowaway(
      (client) => client.$executeRaw`INSERT INTO customer (id) VALUES (${randomUUID()}::uuid)`,
    );

    expect(outcome).toBe("not_null_violation");
  });

  it("gives record_not_found for an update of a missing record", async () => {
    const outcome = await classifyFailureOnThrowaway((client) =>
      client.customer.update({ where: { id: randomUUID() }, data: { phoneE164: uniquePhone() } }),
    );

    expect(outcome).toBe("record_not_found");
  });

  it("gives connection when nothing listens on the port", async () => {
    const port = await findClosedPort();

    const outcome = await classifyFailureOf(
      `postgresql://shop@127.0.0.1:${String(port)}/entana`,
      (client) => client.$queryRaw`SELECT 1`,
    );

    expect(outcome).toBe("connection");
  });

  // The shape of this error depends on how `localhost` resolves (::1, 127.0.0.1 or both), so only
  // the kind is asserted, never the raw error. A deployed application connects through a name.
  it("gives connection when the host is localhost and nothing listens on the port", async () => {
    const port = await findClosedPort();

    const outcome = await classifyFailureOf(
      `postgresql://shop@localhost:${String(port)}/entana`,
      (client) => client.$queryRaw`SELECT 1`,
      { connectionTimeoutMs: 300 },
    );

    expect(outcome).toBe("connection");
  });

  // Reset, not a plain close: a plain close sometimes gives pg's code-less "terminated unexpectedly"
  // error instead (about 1 in 12 runs), which has no structure to match. The same event gives
  // P1017 for a model query and P2010 for a raw query, each with driver kind ConnectionClosed.
  // The connection timeout is generous: the server answers at once, so it only guards a hang.
  it.each([
    [
      "a model query",
      (client: PrismaClient) => client.customer.findFirst({ select: { id: true } }),
    ],
    ["a raw query", (client: PrismaClient) => client.$queryRaw`SELECT 1`],
  ])(
    "gives connection when the server accepts the connection and resets it (%s)",
    async (_name, query) => {
      const server = net.createServer((socket) => {
        socket.on("error", () => undefined);
        socket.resetAndDestroy();
      });
      await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
      const address = server.address();
      try {
        if (address === null || typeof address === "string")
          throw new Error("No port was assigned.");

        const outcome = await classifyFailureOf(
          `postgresql://shop@127.0.0.1:${String(address.port)}/entana`,
          query,
          { connectionTimeoutMs: 2000 },
        );

        expect(outcome).toBe("connection");
      } finally {
        await new Promise<void>((resolve) => {
          server.close(() => {
            resolve();
          });
        });
      }
    },
  );

  // The backend is ended by its exact pid, and only if it belongs to the throwaway database. The
  // setup is outside the classified part: a failed setup must show as itself, not as `unknown`.
  it("gives connection when the backend of a running query is terminated", async () => {
    const connectionString = inject("throwawayConnectionString");
    const admin = new Client({ connectionString });
    // One connection only, so the pid read below is the one that runs the long query.
    const client = createPrismaClient({ connectionString, maxConnections: 1 });
    await admin.connect();
    try {
      await assertThrowawayDatabase(admin);
      await assertThrowawayDatabase(client);
      const rows = await client.$queryRaw<{ pid: number }[]>`SELECT pg_backend_pid() AS pid`;
      const pid = rows[0]?.pid;
      if (pid === undefined) throw new Error("No backend pid was returned.");
      const running = client.$queryRaw`SELECT pg_sleep(5)::text AS slept`.then(
        () => "no error" as const,
        (error: unknown) => classifyDatabaseError(error),
      );
      await vi.waitFor(
        async () => {
          const { rowCount } = await admin.query(
            "SELECT 1 FROM pg_stat_activity WHERE pid = $1 AND datname = current_database() AND wait_event = 'PgSleep'",
            [pid],
          );
          expect(rowCount).toBe(1);
        },
        { timeout: 3000 },
      );
      const terminated = await admin.query<{ terminated: boolean }>(
        "SELECT pg_terminate_backend(pid) AS terminated FROM pg_stat_activity WHERE pid = $1 AND datname = current_database()",
        [pid],
      );
      expect(terminated.rows).toEqual([{ terminated: true }]);

      expect(await running).toBe("connection");
    } finally {
      await client.$disconnect();
      await admin.end();
    }
  });

  // Pinned to pg 8.23.1 and Prisma 7.10.0: this error has no code, so the classifier matches the
  // fixed text of pg. Revisit isPoolConnectTimeout when pg is upgraded.
  it("gives timeout when the server accepts and never answers", async () => {
    const sockets: net.Socket[] = [];
    const server = net.createServer((socket) => sockets.push(socket));
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    try {
      if (address === null || typeof address === "string") throw new Error("No port was assigned.");

      const outcome = await classifyFailureOf(
        `postgresql://shop@127.0.0.1:${String(address.port)}/entana`,
        (client) => client.$queryRaw`SELECT 1`,
        { connectionTimeoutMs: 300 },
      );

      expect(outcome).toBe("timeout");
    } finally {
      sockets.forEach((socket) => socket.destroy());
      await new Promise<void>((resolve) => {
        server.close(() => {
          resolve();
        });
      });
    }
  });
});
