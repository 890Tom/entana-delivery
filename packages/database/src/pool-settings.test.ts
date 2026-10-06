import { describe, expect, it } from "vitest";

import {
  InvalidDatabaseOptionsError,
  maxConnectionsLimit,
  toPoolSettings,
} from "./pool-settings.ts";

const password = "s3cret-pass-word";
const connectionString = `postgresql://shop:${password}@db.internal:5432/entana`;

function captureError(action: () => unknown): Error {
  try {
    action();
  } catch (error) {
    if (error instanceof Error) {
      return error;
    }
    throw error;
  }
  throw new Error("The action was expected to throw.");
}

// The secret must be nowhere: message, stack, string form, own properties (cause included).
function expectNoSecret(error: Error, secrets: readonly string[]): void {
  const properties = Object.getOwnPropertyNames(error).map((name) =>
    JSON.stringify(Object.getOwnPropertyDescriptor(error, name)?.value),
  );
  const everything = [error.message, error.stack, String(error), ...properties].join("\n");
  for (const secret of secrets) {
    expect(everything).not.toContain(secret);
  }
}

describe("toPoolSettings", () => {
  it("uses 10 connections and a 5000 ms timeout by default", () => {
    expect(toPoolSettings({ connectionString })).toEqual({
      connectionString,
      max: 10,
      connectionTimeoutMillis: 5000,
    });
  });

  it("maps the given options to the pool settings", () => {
    expect(
      toPoolSettings({ connectionString, maxConnections: 3, connectionTimeoutMs: 250 }),
    ).toEqual({ connectionString, max: 3, connectionTimeoutMillis: 250 });
  });

  it("accepts 1 as the smallest valid value of both numeric options", () => {
    expect(
      toPoolSettings({ connectionString, maxConnections: 1, connectionTimeoutMs: 1 }),
    ).toMatchObject({ max: 1, connectionTimeoutMillis: 1 });
  });

  it("keeps the default of an option that is not given", () => {
    expect(toPoolSettings({ connectionString, maxConnections: 4 })).toMatchObject({
      max: 4,
      connectionTimeoutMillis: 5000,
    });
  });

  const invalidNumbers = [
    0,
    -1,
    1.5,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.MAX_SAFE_INTEGER + 1,
  ];

  it.each(invalidNumbers.map((value) => ({ value })))(
    "refuses $value for maxConnections and names the option",
    ({ value }) => {
      const error = captureError(() => toPoolSettings({ connectionString, maxConnections: value }));

      expect(error).toBeInstanceOf(InvalidDatabaseOptionsError);
      expect(error.message).toContain("maxConnections");
    },
  );

  it.each(invalidNumbers.map((value) => ({ value })))(
    "refuses $value for connectionTimeoutMs and names the option",
    ({ value }) => {
      const error = captureError(() =>
        toPoolSettings({ connectionString, connectionTimeoutMs: value }),
      );

      expect(error).toBeInstanceOf(InvalidDatabaseOptionsError);
      expect(error.message).toContain("connectionTimeoutMs");
    },
  );

  it.each(["", "   "])("refuses the blank connection string %j and names the option", (blank) => {
    const error = captureError(() => toPoolSettings({ connectionString: blank }));

    expect(error).toBeInstanceOf(InvalidDatabaseOptionsError);
    expect(error.message).toContain("connectionString");
  });

  it.each([
    { connectionString, maxConnections: 0 },
    { connectionString, maxConnections: maxConnectionsLimit + 1 },
    { connectionString, connectionTimeoutMs: -1 },
  ])("never puts the connection string in an error message (%j)", (options) => {
    const error = captureError(() => toPoolSettings(options));

    expectNoSecret(error, [password, connectionString]);
  });

  describe("upper bound of maxConnections", () => {
    it("accepts the limit itself and the value just below it", () => {
      expect(
        toPoolSettings({ connectionString, maxConnections: maxConnectionsLimit - 1 }).max,
      ).toBe(49);
      expect(toPoolSettings({ connectionString, maxConnections: maxConnectionsLimit }).max).toBe(
        50,
      );
    });

    it("refuses the value just above the limit", () => {
      const error = captureError(() =>
        toPoolSettings({ connectionString, maxConnections: maxConnectionsLimit + 1 }),
      );

      expect(error).toBeInstanceOf(InvalidDatabaseOptionsError);
      expect(error.message).toContain("maxConnections");
    });

    it("never repeats the refused value in the message, whatever its size", () => {
      const huge = 123456789012345;

      const error = captureError(() => toPoolSettings({ connectionString, maxConnections: huge }));

      expect(error.message).not.toContain(String(huge));
    });
  });

  describe("connection string format", () => {
    it.each(["postgres", "postgresql"])("accepts the %s scheme", (scheme) => {
      const value = `${scheme}://shop:${password}@db.internal:5432/entana`;

      expect(toPoolSettings({ connectionString: value }).connectionString).toBe(value);
    });

    it("accepts an uppercase scheme: URL.protocol lowercases it", () => {
      const value = `POSTGRESQL://shop:${password}@db.internal:5432/entana`;

      expect(toPoolSettings({ connectionString: value }).connectionString).toBe(value);
    });

    it.each([
      { label: "http scheme", value: `http://shop:${password}@db.internal/entana` },
      { label: "https scheme", value: `https://shop:${password}@db.internal/entana` },
      { label: "no scheme", value: `shop:${password}@db.internal:5432/entana` },
      { label: "unparsable port", value: `postgresql://shop:${password}@db.internal:notaport/db` },
      { label: "unclosed IPv6 bracket", value: `postgresql://shop:${password}@[::1/db` },
      { label: "key-value format", value: `host=db.internal user=shop password=${password}` },
      { label: "surrounding whitespace", value: ` ${connectionString} ` },
      { label: "trailing newline (env file)", value: `${connectionString}\n` },
      { label: "trailing tab", value: `${connectionString}\t` },
      { label: "tab inside the host", value: `postgresql://shop:${password}@db.\tinternal/entana` },
      {
        label: "newline inside the host",
        value: `postgresql://shop:${password}@db\n.internal/entana`,
      },
      { label: "leading control character", value: `\u0001${connectionString}` },
      { label: "space inside", value: `postgresql://shop:${password} x@db.internal/entana` },
      { label: "unrelated text", value: `not a url ${password}` },
      { label: "other database scheme", value: `mysql://shop:${password}@db.internal/entana` },
    ])("refuses $label and never leaks the password", ({ value }) => {
      const error = captureError(() => toPoolSettings({ connectionString: value }));

      expect(error).toBeInstanceOf(InvalidDatabaseOptionsError);
      expect(error.message).toContain("connectionString");
      expect(error.cause).toBeUndefined();
      expectNoSecret(error, [password, "db.internal"]);
    });
  });
});
