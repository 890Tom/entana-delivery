import { PrismaPg } from "@prisma/adapter-pg";
import type * as AdapterModule from "@prisma/adapter-pg";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createPrismaClient } from "./create-prisma-client.ts";
import { InvalidDatabaseOptionsError } from "./pool-settings.ts";

// The adapter is an external boundary: the real one is used, except where a test makes it fail.
vi.mock("@prisma/adapter-pg", async (importOriginal) => {
  const original = await importOriginal<typeof AdapterModule>();
  return { PrismaPg: vi.fn(original.PrismaPg) };
});

const password = "s3cret-pass-word";
const connectionString = `postgresql://shop:${password}@db.internal:5432/entana`;

function captureError(action: () => unknown): unknown {
  try {
    action();
  } catch (error) {
    return error;
  }
  throw new Error("The action was expected to throw.");
}

function expectGenericError(thrown: unknown): void {
  expect(thrown).toBeInstanceOf(InvalidDatabaseOptionsError);
  if (!(thrown instanceof InvalidDatabaseOptionsError)) {
    return;
  }
  expect(thrown.cause).toBeUndefined();
  expect([thrown.message, thrown.stack, String(thrown)].join("\n")).not.toContain(password);
}

afterEach(() => {
  vi.mocked(PrismaPg).mockClear();
});

describe("createPrismaClient", () => {
  it.each([0, 51])("refuses %s connections and names the option", (maxConnections) => {
    const thrown = captureError(() => createPrismaClient({ connectionString, maxConnections }));

    expect(thrown).toBeInstanceOf(InvalidDatabaseOptionsError);
    expect(String(thrown)).toContain("maxConnections");
  });

  it("gives the adapter the validated settings, defaults included", () => {
    createPrismaClient({ connectionString, connectionTimeoutMs: 250 });

    expect(PrismaPg).toHaveBeenCalledExactlyOnceWith({
      connectionString,
      max: 10,
      connectionTimeoutMillis: 250,
    });
  });

  it("builds a client without connecting: nothing listens on this host", async () => {
    const client = createPrismaClient({ connectionString });

    await expect(client.$disconnect()).resolves.toBeUndefined();
  });

  it.each([
    `postgresql://shop:${password}@db.internal:notaport/entana`,
    `not a url ${password}`,
    `http://shop:${password}@db.internal/entana`,
  ])("refuses a malformed connection string without leaking it (%#)", (malformed) => {
    expectGenericError(captureError(() => createPrismaClient({ connectionString: malformed })));
  });

  it("wraps an adapter failure in a generic error: the original error is dropped", () => {
    vi.mocked(PrismaPg).mockImplementationOnce(() => {
      throw new Error(`adapter exploded with ${connectionString}`);
    });

    const thrown = captureError(() => createPrismaClient({ connectionString }));

    expectGenericError(thrown);
    expect(String(thrown)).toBe(
      'InvalidDatabaseOptionsError: Invalid database option "connectionString": the client could not be built.',
    );
  });
});
