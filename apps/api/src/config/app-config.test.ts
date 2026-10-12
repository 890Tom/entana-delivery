import { describe, expect, it } from "vitest";
import { InvalidConfigurationError, parseConfig } from "./app-config.js";
import type { AppConfig } from "./app-config.js";

const validDatabaseUrl = "postgresql://test:test@localhost:5432/test";

const adminOrigin = "https://admin.example.mg";

// DATABASE_URL is required, and so are the admin origins in production (the default environment):
// every test that is not about them starts from valid ones.
function parse(env: Record<string, string>): AppConfig {
  return parseConfig({
    DATABASE_URL: validDatabaseUrl,
    ADMIN_ALLOWED_ORIGINS: adminOrigin,
    ...env,
  });
}

function expectInvalidEnv(env: Record<string, string>): InvalidConfigurationError {
  let caught: unknown;
  try {
    parseConfig(env);
  } catch (error: unknown) {
    caught = error;
  }
  if (!(caught instanceof InvalidConfigurationError)) {
    throw new Error("The configuration was expected to be refused.");
  }
  return caught;
}

function expectInvalid(env: Record<string, string>): InvalidConfigurationError {
  return expectInvalidEnv({
    DATABASE_URL: validDatabaseUrl,
    ADMIN_ALLOWED_ORIGINS: adminOrigin,
    ...env,
  });
}

describe("parseConfig", () => {
  it("applies safe defaults when nothing is set", () => {
    expect(parse({})).toEqual({
      // Production, so that a deployment that forgets NODE_ENV exposes nothing it should not.
      nodeEnv: "production",
      // 0.0.0.0 so that the API is reachable from outside a container.
      host: "0.0.0.0",
      port: 3000,
      logLevel: "info",
      corsOrigins: [],
      adminAllowedOrigins: [adminOrigin],
      isAdminCookieSecure: true,
      trustProxy: false,
      bodyLimitKb: 100,
      isSwaggerEnabled: false,
      databaseUrl: validDatabaseUrl,
      instanceConfigPath: undefined,
      mediaRoot: undefined,
    });
  });

  it("reads every variable", () => {
    const config = parse({
      NODE_ENV: "production",
      HOST: "127.0.0.1",
      PORT: "8080",
      LOG_LEVEL: "warn",
      CORS_ORIGINS: "https://shop.example.mg, https://admin.example.mg",
      ADMIN_ALLOWED_ORIGINS: "https://admin.example.mg, https://backoffice.example.mg",
      ADMIN_COOKIE_SECURE: "false",
      TRUST_PROXY: "1",
      BODY_LIMIT_KB: "20",
      SWAGGER_ENABLED: "true",
      DATABASE_URL: "postgresql://entana:s3cret-pass-word@localhost:5433/entana",
      INSTANCE_CONFIG_PATH: "/etc/entana/instance.config.yaml",
      MEDIA_ROOT: "/media",
    });
    expect(config).toEqual({
      nodeEnv: "production",
      host: "127.0.0.1",
      port: 8080,
      logLevel: "warn",
      corsOrigins: ["https://shop.example.mg", "https://admin.example.mg"],
      adminAllowedOrigins: ["https://admin.example.mg", "https://backoffice.example.mg"],
      isAdminCookieSecure: false,
      trustProxy: 1,
      bodyLimitKb: 20,
      isSwaggerEnabled: true,
      databaseUrl: "postgresql://entana:s3cret-pass-word@localhost:5433/entana",
      instanceConfigPath: "/etc/entana/instance.config.yaml",
      mediaRoot: "/media",
    });
  });

  it("accepts the limits of the valid ranges", () => {
    expect(parse({ PORT: "1", BODY_LIMIT_KB: "1" })).toMatchObject({
      port: 1,
      bodyLimitKb: 1,
    });
    expect(parse({ PORT: "65535", BODY_LIMIT_KB: "10240" })).toMatchObject({
      port: 65535,
      bodyLimitKb: 10240,
    });
  });

  it("treats an empty variable as not set", () => {
    expect(parse({ PORT: "", CORS_ORIGINS: "", LOG_LEVEL: "" }).port).toBe(3000);
  });

  it("ignores variables it does not know", () => {
    expect(parse({ FOO: "bar", PATH: "/bin" })).toEqual(parse({}));
  });

  describe("database URL", () => {
    const password = "s3cret-pass-word";

    it("is returned unchanged", () => {
      const url = `postgresql://entana:${password}@localhost:5433/entana?schema=public`;
      expect(parse({ DATABASE_URL: url }).databaseUrl).toBe(url);
    });

    it.each([
      ["absent", {}],
      ["empty", { DATABASE_URL: "" }],
    ])("is required: refuses it when %s", (_label, env) => {
      const error = expectInvalidEnv(env);
      expect(error.issues).toHaveLength(1);
      expect(error.issues[0]).toMatch(/^DATABASE_URL: /);
    });

    it.each([
      ["a space", `postgresql://entana:${password} x@localhost/entana`],
      ["a trailing newline", `postgresql://entana:${password}@localhost/entana\n`],
      ["a trailing carriage return", `postgresql://entana:${password}@localhost/entana\r`],
      ["a tab", `postgresql://entana:${password}@localhost/\tentana`],
      ["a null character", `postgresql://entana:${password}@localhost/entana\u0000`],
    ])("refuses %s, names the variable and never repeats the value", (_label, url) => {
      const error = expectInvalidEnv({ DATABASE_URL: url });
      expect(error.issues).toHaveLength(1);
      expect(error.issues[0]).toMatch(/^DATABASE_URL: /);
      expect(error.message).not.toContain(password);
      expect(JSON.stringify(error.issues)).not.toContain(password);
    });
  });

  describe("administration", () => {
    it("requires the allowed origins in production, and names the variable", () => {
      const error = expectInvalidEnv({ DATABASE_URL: validDatabaseUrl, NODE_ENV: "production" });
      expect(error.issues).toEqual([expect.stringMatching(/^ADMIN_ALLOWED_ORIGINS: /)]);
    });

    it.each(["development", "test"])("defaults to the Vite server when NODE_ENV is %s", (env) => {
      const config = parseConfig({ DATABASE_URL: validDatabaseUrl, NODE_ENV: env });
      expect(config.adminAllowedOrigins).toEqual(["http://localhost:5173"]);
    });

    it("refuses an origin with a path or a wildcard", () => {
      expect(
        expectInvalid({ ADMIN_ALLOWED_ORIGINS: "https://admin.example.mg/app" }).issues,
      ).toEqual([expect.stringMatching(/^ADMIN_ALLOWED_ORIGINS: /)]);
    });

    it("makes the cookie Secure in production and not in development, unless it is set", () => {
      expect(parse({}).isAdminCookieSecure).toBe(true);
      expect(parse({ NODE_ENV: "development" }).isAdminCookieSecure).toBe(false);
      expect(
        parse({ NODE_ENV: "development", ADMIN_COOKIE_SECURE: "true" }).isAdminCookieSecure,
      ).toBe(true);
    });
  });

  describe("Swagger", () => {
    it("is off by default in production", () => {
      expect(parse({ NODE_ENV: "production" }).isSwaggerEnabled).toBe(false);
    });

    it("is off by default when NODE_ENV is not set", () => {
      expect(parse({}).isSwaggerEnabled).toBe(false);
    });

    it.each(["development", "test"])("is on by default when NODE_ENV is %s", (nodeEnv) => {
      expect(parse({ NODE_ENV: nodeEnv }).isSwaggerEnabled).toBe(true);
    });

    it("can be switched on in production and off in development", () => {
      expect(parse({ NODE_ENV: "production", SWAGGER_ENABLED: "true" }).isSwaggerEnabled).toBe(
        true,
      );
      expect(parse({ NODE_ENV: "development", SWAGGER_ENABLED: "false" }).isSwaggerEnabled).toBe(
        false,
      );
    });
  });

  describe("trust proxy", () => {
    it("is off by default", () => {
      expect(parse({}).trustProxy).toBe(false);
    });

    it("accepts the explicit word false", () => {
      expect(parse({ TRUST_PROXY: "false" }).trustProxy).toBe(false);
    });

    it.each(["true", "0", "-1", "1.5", "loopback", "10.0.0.1"])(
      "refuses %s, because only a number of proxy hops is safe",
      (value) => {
        expect(expectInvalid({ TRUST_PROXY: value }).issues[0]).toMatch(/^TRUST_PROXY: /);
      },
    );
  });

  describe("CORS origins", () => {
    it("refuses a value that is not an origin", () => {
      expect(expectInvalid({ CORS_ORIGINS: "https://shop.example.mg/path" }).issues[0]).toMatch(
        /^CORS_ORIGINS: /,
      );
      expect(expectInvalid({ CORS_ORIGINS: "not a url" }).issues[0]).toMatch(/^CORS_ORIGINS: /);
    });

    it("refuses the wildcard", () => {
      expect(expectInvalid({ CORS_ORIGINS: "*" }).issues[0]).toMatch(/^CORS_ORIGINS: /);
    });

    it("ignores a trailing comma and spaces", () => {
      const config = parse({ CORS_ORIGINS: " https://a.example.mg ,https://b.example.mg, " });
      expect(config.corsOrigins).toEqual(["https://a.example.mg", "https://b.example.mg"]);
    });

    it("refuses the whole list when one origin is invalid", () => {
      expectInvalid({ CORS_ORIGINS: "https://a.example.mg,https://b.example.mg/path" });
    });
  });

  it.each([
    ["NODE_ENV", "staging"],
    ["PORT", "0"],
    ["PORT", "65536"],
    ["PORT", "70000"],
    ["PORT", "1.5"],
    ["PORT", "abc"],
    ["LOG_LEVEL", "verbose"],
    ["BODY_LIMIT_KB", "0"],
    ["BODY_LIMIT_KB", "10241"],
    ["SWAGGER_ENABLED", "maybe"],
  ])("refuses %s=%s and names the variable", (name, value) => {
    const error = expectInvalid({ [name]: value });
    expect(error.issues).toHaveLength(1);
    expect(error.issues[0]).toMatch(new RegExp(`^${name}: `));
  });

  it("lists every invalid variable at once", () => {
    const error = expectInvalid({ PORT: "abc", LOG_LEVEL: "verbose" });
    expect(error.issues.map((issue) => issue.split(":")[0])).toEqual(["PORT", "LOG_LEVEL"]);
    expect(error.message).toContain("PORT");
    expect(error.message).toContain("LOG_LEVEL");
  });

  it.each([
    "NODE_ENV",
    "PORT",
    "LOG_LEVEL",
    "CORS_ORIGINS",
    "TRUST_PROXY",
    "BODY_LIMIT_KB",
    "SWAGGER_ENABLED",
  ])("never repeats the value it refused for %s, which could be a secret", (name) => {
    const error = expectInvalid({ [name]: "hunter2-secret" });
    // The message is printed at startup and the issues could be logged: neither may hold it.
    expect(error.message).not.toContain("hunter2");
    expect(JSON.stringify(error.issues)).not.toContain("hunter2");
  });
});
