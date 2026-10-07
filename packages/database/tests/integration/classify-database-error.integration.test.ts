import { randomInt, randomUUID } from "node:crypto";
import net from "node:net";
import { describe, expect, inject, it } from "vitest";

import { classifyDatabaseError } from "../../src/classify-database-error.ts";
import type { DatabaseErrorKind } from "../../src/classify-database-error.ts";
import { createPrismaClient } from "../../src/create-prisma-client.ts";
import type { PrismaClient } from "../../src/generated/client.ts";
import type { DatabaseClientOptions } from "../../src/pool-settings.ts";
import { assertThrowawayDatabase } from "../support/assert-throwaway-database.ts";

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
