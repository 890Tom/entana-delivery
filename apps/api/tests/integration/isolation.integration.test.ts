import { createPrismaClient } from "@entana/database";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import type { PrismaClient } from "@entana/database";
import {
  NotThrowawayDatabaseError,
  assertThrowawayDatabase,
} from "./support/assert-throwaway-database.js";
import { countRows, findChangedTables } from "./support/count-rows.js";
import { classifyDatabaseHost } from "./support/host-guard.js";
import {
  generateThrowawayDatabaseName,
  isThrowawayDatabaseName,
} from "./support/throwaway-database.js";

describe("assertThrowawayDatabase", () => {
  let throwaway: PrismaClient;
  // Only `SELECT current_database()` ever runs on this client: it is the configured database.
  let configured: PrismaClient;

  beforeAll(() => {
    throwaway = createPrismaClient({
      connectionString: inject("throwawayConnectionString"),
      maxConnections: 1,
    });
    configured = createPrismaClient({
      connectionString: inject("configuredDatabaseUrl"),
      maxConnections: 1,
    });
  });

  afterAll(async () => {
    await throwaway.$disconnect();
    await configured.$disconnect();
  });

  it("accepts the throwaway database of the run", async () => {
    await expect(assertThrowawayDatabase(throwaway)).resolves.toBeUndefined();
  });

  it("refuses the configured database, with a fixed message", async () => {
    await expect(assertThrowawayDatabase(configured)).rejects.toThrow(
      new NotThrowawayDatabaseError(),
    );
    await expect(assertThrowawayDatabase(configured)).rejects.toThrow(
      "Refusing a destructive statement: the connected database is not the throwaway test one.",
    );
  });
});

describe("the throwaway database name", () => {
  it("is generated as test_ and lowercase hex", () => {
    expect(generateThrowawayDatabaseName()).toMatch(/^test_[0-9a-f]{16}$/);
  });

  it.each(["test_0a1b", "test_0123456789abcdef"])("accepts %j", (name) => {
    expect(isThrowawayDatabaseName(name)).toBe(true);
  });

  it.each([
    "",
    "entana",
    "postgres",
    "test_",
    "test_ABC",
    "TEST_abc",
    "test_abc;drop",
    'test_a"b',
    "xtest_abc",
    "test_abc ",
    "test_abc\n",
  ])("does not accept %j", (name) => {
    expect(isThrowawayDatabaseName(name)).toBe(false);
  });

  it("is the name of the database the tests are connected to", () => {
    expect(isThrowawayDatabaseName(inject("throwawayDatabase"))).toBe(true);
  });
});

describe("classifyDatabaseHost", () => {
  it.each([
    "postgresql://u:p@localhost:5433/entana",
    "postgresql://u:p@127.0.0.1/entana",
    "postgresql://u:p@[::1]:5432/entana",
    "postgresql://u:p@localhost/entana?host=localhost",
    "postgresql://u:p@localhost/entana?sslmode=disable",
  ])("calls %j local", (url) => {
    expect(classifyDatabaseHost(url)).toBe("local");
  });

  it.each([
    "postgresql://u:p@db.example.com/entana",
    "postgresql://u:p@localhost/entana?host=db.example.com",
    "postgresql://u:p@localhost/entana?hostaddr=10.0.0.5",
    "postgresql://u:p@localhost/entana?host=/var/run/postgresql",
    "postgresql://u:p@localhost/entana?host=localhost&host=db.example.com",
  ])("calls %j remote", (url) => {
    expect(classifyDatabaseHost(url)).toBe("remote");
  });

  it("calls a string that is not a URL invalid", () => {
    expect(classifyDatabaseHost("not a url")).toBe("invalid");
  });
});

describe("the row counts used to prove the configured database is untouched", () => {
  let throwaway: PrismaClient;

  beforeAll(() => {
    throwaway = createPrismaClient({
      connectionString: inject("throwawayConnectionString"),
      maxConnections: 1,
    });
  });

  afterAll(async () => {
    await throwaway.$disconnect();
  });

  it("lists the tables of the migrated database, and sees one inserted row", async () => {
    await assertThrowawayDatabase(throwaway);
    const before = await countRows(throwaway);

    const created = await throwaway.customer.create({
      data: { phoneE164: "+261330000001" },
      select: { id: true },
    });
    const after = await countRows(throwaway);
    await assertThrowawayDatabase(throwaway);
    await throwaway.customer.delete({ where: { id: created.id } });

    expect(Object.keys(before)).toEqual(expect.arrayContaining(["customer", "product"]));
    expect(findChangedTables(before, after)).toEqual(["customer"]);
  });
});

describe("findChangedTables", () => {
  it("reports no difference for equal counts", () => {
    expect(findChangedTables({ customer: 2, product: 1 }, { customer: 2, product: 1 })).toEqual([]);
  });

  it.each([
    ["a row added", { customer: 3 }, ["customer"]],
    ["a row removed", { customer: 1 }, ["customer"]],
    ["a table that disappeared", {}, ["customer"]],
    ["a table that appeared", { customer: 2, extra: 0 }, ["extra"]],
  ])("reports %s", (_label, after, expected) => {
    expect(findChangedTables({ customer: 2 }, after)).toEqual(expected);
  });
});
