import { InvalidDatabaseOptionsError } from "@entana/database";
import type { PrismaClient } from "@entana/database";
import { Test } from "@nestjs/testing";
import type { TestingModule } from "@nestjs/testing";
import { describe, expect, it, vi } from "vitest";
import { parseConfig } from "../config/app-config.js";
import { DATABASE_CLIENT } from "./database-client.js";
import { DatabaseModule } from "./database.module.js";

const fakeUrl = "postgresql://test:test@localhost:5432/test";

function buildConfig(databaseUrl: string): ReturnType<typeof parseConfig> {
  return parseConfig({ NODE_ENV: "test", DATABASE_URL: databaseUrl });
}

function compileWith(databaseUrl: string): Promise<TestingModule> {
  return Test.createTestingModule({
    imports: [DatabaseModule.register(buildConfig(databaseUrl))],
  }).compile();
}

describe("DatabaseModule", () => {
  it("provides a client built from the configured URL, without a database running", async () => {
    const moduleRef = await compileWith(fakeUrl);

    const client = moduleRef.get<PrismaClient>(DATABASE_CLIENT);

    // The client connects on the first query only: nothing listens on this URL.
    expect(client).toBeDefined();
    expect(moduleRef.get<PrismaClient>(DATABASE_CLIENT)).toBe(client);
    await moduleRef.close();
  });

  it("disconnects the client when the application shuts down", async () => {
    const moduleRef = await compileWith(fakeUrl);
    // A spy that calls through: the real client is disconnected, we only observe the call.
    const disconnect = vi.spyOn(moduleRef.get<PrismaClient>(DATABASE_CLIENT), "$disconnect");

    await moduleRef.close();

    expect(disconnect).toHaveBeenCalledOnce();
  });

  it("refuses to start with a URL the database client rejects, without leaking the password", async () => {
    const password = "s3cret-pass-word";

    const failure: unknown = await compileWith(`mysql://test:${password}@localhost:5432/test`).then(
      () => undefined,
      (error: unknown) => error,
    );

    expect(failure).toBeInstanceOf(InvalidDatabaseOptionsError);
    expect(failure).toSatisfy(
      (error: Error) => !JSON.stringify(serialise(error)).includes(password),
    );
  });
});

// Every own property, including the non-enumerable message and stack, and a `cause`.
function serialise(error: unknown): Record<string, unknown> {
  if (!(error instanceof Error)) {
    return {};
  }
  return Object.fromEntries(
    Object.getOwnPropertyNames(error).map((name) => [name, Reflect.get(error, name)]),
  );
}
