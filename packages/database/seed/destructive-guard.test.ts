import { describe, expect, it } from "vitest";
import {
  destructiveSeedRefusals,
  isLocalDatabaseHost,
  optInFlagsDefinedByEnvFile,
  seedRefusals,
} from "./destructive-guard.ts";

describe("isLocalDatabaseHost", () => {
  it.each([
    "postgresql://entana:secret@localhost:5433/entana",
    "postgresql://entana:secret@127.0.0.1:5433/entana",
    "postgresql://entana:secret@[::1]:5433/entana",
    "postgresql://entana:secret@postgres:5432/entana",
    "postgres://entana@LOCALHOST/entana",
  ])("accepts %s", (url) => {
    expect(isLocalDatabaseHost(url)).toBe(true);
  });

  it.each([
    ["a remote host", "postgresql://entana:secret@db.example.com:5432/entana"],
    ["a remote IP address", "postgresql://entana:secret@203.0.113.7:5432/entana"],
    [
      "a host that starts with localhost",
      "postgresql://entana:secret@localhost.example.com/entana",
    ],
    ["a trailing dot", "postgresql://entana:secret@localhost./entana"],
    ["localhost as the user name", "postgresql://localhost:secret@db.example.com/entana"],
    ["localhost in the path", "postgresql://entana@db.example.com/localhost"],
    [
      "a host overridden by a query parameter",
      "postgresql://entana@localhost/entana?host=db.example.com",
    ],
    ["a hostaddr query parameter", "postgresql://entana@localhost/entana?hostaddr=203.0.113.7"],
    ["a Unix socket (empty host)", "postgresql:///entana?user=entana"],
    ["several hosts", "postgresql://localhost,db.example.com/entana"],
    ["not a URL", "localhost"],
    ["an empty string", ""],
  ])("refuses %s", (_label, url) => {
    expect(isLocalDatabaseHost(url)).toBe(false);
  });
});

describe("destructiveSeedRefusals", () => {
  const allowed = {
    NODE_ENV: "development",
    ALLOW_DESTRUCTIVE_SEED: "true",
    DATABASE_URL: "postgresql://entana:secret@localhost:5433/entana",
  };

  it("has no refusal when everything is in order", () => {
    expect(destructiveSeedRefusals(allowed)).toEqual([]);
  });

  it("has no refusal when NODE_ENV is not set", () => {
    expect(destructiveSeedRefusals({ ...allowed, NODE_ENV: undefined })).toEqual([]);
  });

  it("refuses in production, even on a local host with the flag set", () => {
    expect(destructiveSeedRefusals({ ...allowed, NODE_ENV: "production" })).toEqual([
      "NODE_ENV is production.",
    ]);
  });

  it.each([undefined, "", "false", "TRUE", "1", "yes"])(
    "refuses when ALLOW_DESTRUCTIVE_SEED is %j",
    (value) => {
      expect(destructiveSeedRefusals({ ...allowed, ALLOW_DESTRUCTIVE_SEED: value })).toHaveLength(
        1,
      );
    },
  );

  it("refuses a remote host and a missing DATABASE_URL", () => {
    expect(
      destructiveSeedRefusals({ ...allowed, DATABASE_URL: "postgresql://u:p@db.example.com/x" }),
    ).toHaveLength(1);
    expect(destructiveSeedRefusals({ ...allowed, DATABASE_URL: undefined })).toHaveLength(1);
  });

  it("lists every reason at once", () => {
    expect(
      destructiveSeedRefusals({ NODE_ENV: "production", DATABASE_URL: "postgresql://u:p@x.io/y" }),
    ).toHaveLength(3);
  });
});

describe("seedRefusals", () => {
  const local = "postgresql://entana:secret@localhost:5433/entana";

  it("has no refusal on a local host", () => {
    expect(seedRefusals({ NODE_ENV: "development", DATABASE_URL: local })).toEqual([]);
    expect(seedRefusals({ DATABASE_URL: local })).toEqual([]);
  });

  it("refuses in production, even on a local host", () => {
    expect(seedRefusals({ NODE_ENV: "production", DATABASE_URL: local })).toHaveLength(1);
  });

  it("refuses a remote host without the explicit opt-in", () => {
    const remote = "postgresql://u:p@db.example.com:5432/x";
    expect(seedRefusals({ DATABASE_URL: remote })).toHaveLength(1);
    expect(seedRefusals({ DATABASE_URL: remote, ALLOW_SEED_NON_LOCAL: "yes" })).toHaveLength(1);
    expect(seedRefusals({ DATABASE_URL: remote, ALLOW_SEED_NON_LOCAL: "true" })).toEqual([]);
  });

  it("does not let the opt-in override production", () => {
    expect(
      seedRefusals({
        NODE_ENV: "production",
        DATABASE_URL: "postgresql://u:p@db.example.com/x",
        ALLOW_SEED_NON_LOCAL: "true",
      }),
    ).toHaveLength(1);
  });

  it("refuses an unparsable URL without the opt-in", () => {
    expect(seedRefusals({ DATABASE_URL: "not a url" })).toHaveLength(1);
    expect(seedRefusals({})).toHaveLength(1);
  });
});

describe("optInFlagsDefinedByEnvFile", () => {
  it("is empty when the .env file defines none", () => {
    expect(optInFlagsDefinedByEnvFile({}, { NODE_ENV: "development" })).toEqual([]);
  });

  it("names a flag that only the .env file defines", () => {
    expect(optInFlagsDefinedByEnvFile({}, { ALLOW_DESTRUCTIVE_SEED: "true" })).toEqual([
      "ALLOW_DESTRUCTIVE_SEED",
    ]);
    expect(optInFlagsDefinedByEnvFile({}, { ALLOW_SEED_NON_LOCAL: "true" })).toEqual([
      "ALLOW_SEED_NON_LOCAL",
    ]);
  });

  it("accepts a flag given in the shell, even when the .env file repeats it", () => {
    const shell = { ALLOW_DESTRUCTIVE_SEED: "true" };
    expect(optInFlagsDefinedByEnvFile(shell, shell)).toEqual([]);
  });
});
