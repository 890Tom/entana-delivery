import { DATABASE_CLIENT } from "../../src/database/client-token/database-client.js";
import { InvalidDatabaseOptionsError } from "@entana/database";
import type { PrismaClient } from "@entana/database";
import { afterEach, describe, expect, it, vi } from "vitest";
import { startRealApp } from "./support/create-test-app.js";
import { captureLogs } from "./support/log-capture.js";
import { buildTestConfig } from "./support/test-config.js";

describe("application start with a database URL", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("refuses to boot with an invalid URL and writes the password nowhere", async () => {
    const password = "s3cret-pass-word";
    const logs = captureLogs();
    const written: string[] = [];
    // Nest writes a boot failure to the console streams: everything written is collected.
    vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
      written.push(String(chunk));
      return true;
    });
    vi.spyOn(process.stderr, "write").mockImplementation((chunk) => {
      written.push(String(chunk));
      return true;
    });
    // The configuration only checks for spaces and control characters: it is the database client
    // that refuses a URL that is not a PostgreSQL one.
    const config = buildTestConfig({
      DATABASE_URL: `mysql://test:${password}@localhost:5432/test`,
      LOG_LEVEL: "info",
    });

    const failure: unknown = await startRealApp(config, logs.stream).then(
      () => undefined,
      (error: unknown) => error,
    );
    // Nest flushes its buffered boot logs just after the failure.
    await new Promise((resolve) => setImmediate(resolve));

    expect(failure).toBeInstanceOf(InvalidDatabaseOptionsError);
    // Positive control: Nest's own report of the failure was captured, so its absence of the
    // password means something.
    expect(written.join("")).toContain("Invalid database option");
    const everything = [
      failure instanceof Error ? `${failure.message}\n${String(failure.stack)}` : "",
      JSON.stringify(failure),
      logs.text(),
      ...written,
    ].join("\n");
    expect(everything).not.toContain(password);
  });

  it("disconnects the database client when the real application closes", async () => {
    const app = await startRealApp(buildTestConfig());
    const disconnect = vi.spyOn(app.get<PrismaClient>(DATABASE_CLIENT), "$disconnect");

    await app.close();

    expect(disconnect).toHaveBeenCalledOnce();
  });
});
