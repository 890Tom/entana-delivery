import { createPrismaClient } from "@entana/database";
import type { PrismaClient } from "@entana/database";
import { inject } from "vitest";
import type { Clock } from "../../../src/clock.js";
import { OrdersService } from "../../../src/orders/orders.service.js";
import type { RandomBytes } from "../../../src/orders/orders.service.js";
import { assertThrowawayDatabase } from "./assert-throwaway-database.js";

export const START = new Date("2026-10-08T08:00:00.000Z");

/** A clock the test moves by hand. */
export class ManualClock implements Clock {
  constructor(private current: Date = START) {}

  now(): Date {
    return this.current;
  }

  advanceMinutes(minutes: number): void {
    this.advanceMilliseconds(minutes * 60_000);
  }

  advanceMilliseconds(milliseconds: number): void {
    this.current = new Date(this.current.getTime() + milliseconds);
  }
}

/** Enough connections for 20 simultaneous requests plus the test's own queries. */
export function openOrdersClient(): PrismaClient {
  return createPrismaClient({
    connectionString: inject("throwawayConnectionString"),
    maxConnections: 25,
  });
}

export function createOrdersService(
  client: PrismaClient,
  options: { clock?: Clock; randomBytes?: RandomBytes } = {},
): OrdersService {
  const defaultRandom: RandomBytes = (count) => crypto.getRandomValues(new Uint8Array(count));
  return new OrdersService(
    client,
    options.clock ?? new ManualClock(),
    options.randomBytes ?? defaultRandom,
    "261",
  );
}

/** Empties the order tables and the products, children first (foreign keys are RESTRICT). */
export async function resetOrderData(client: PrismaClient): Promise<void> {
  await assertThrowawayDatabase(client);
  await client.orderEvent.deleteMany();
  await client.orderItem.deleteMany();
  await client.customerOrder.deleteMany();
  await client.customer.deleteMany();
  await client.product.deleteMany();
}

/**
 * How many text, varchar and jsonb cells of the whole public schema contain `needle`. The needle
 * is a bound parameter; table and column names come from the server's own catalogue.
 */
export async function countCellsContaining(client: PrismaClient, needle: string): Promise<number> {
  const columns = await client.$queryRaw<{ table: string; column: string }[]>`
    SELECT table_name AS "table", column_name AS "column" FROM information_schema.columns
    WHERE table_schema = 'public' AND data_type IN ('text', 'character varying', 'jsonb')`;
  let found = 0;
  for (const { table, column } of columns) {
    const sql = `SELECT count(*)::int AS n FROM public."${table}" WHERE "${column}"::text LIKE '%' || $1 || '%'`;
    const rows = await client.$queryRawUnsafe<{ n: number }[]>(sql, needle);
    found += rows[0]?.n ?? 0;
  }
  return found;
}

/** The error, whatever it is: a test then inspects it. Fails if the promise resolves. */
export async function captureError(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error: unknown) {
    return error;
  }
  throw new Error("The promise was expected to be rejected.");
}

/** Name, message, stack and every own property of an error, as one string. */
export function describeError(error: unknown): string {
  if (!(error instanceof Error)) {
    return String(error);
  }
  const own = JSON.stringify(error, Object.getOwnPropertyNames(error));
  return `${error.name} ${error.message} ${String(error.stack)} ${own}`;
}
