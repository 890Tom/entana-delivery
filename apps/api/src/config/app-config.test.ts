import { describe, expect, it } from "vitest";
import { InvalidConfigurationError, parseConfig } from "./app-config.js";

function expectInvalid(env: Record<string, string>): InvalidConfigurationError {
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

describe("parseConfig", () => {
  it("applies safe defaults when nothing is set", () => {
    expect(parseConfig({})).toEqual({
      // Production, so that a deployment that forgets NODE_ENV exposes nothing it should not.
      nodeEnv: "production",
      // 0.0.0.0 so that the API is reachable from outside a container.
      host: "0.0.0.0",
      port: 3000,
      logLevel: "info",
      corsOrigins: [],
      trustProxy: false,
      bodyLimitKb: 100,
      isSwaggerEnabled: false,
    });
  });

  it("reads every variable", () => {
    const config = parseConfig({
      NODE_ENV: "production",
      HOST: "127.0.0.1",
      PORT: "8080",
      LOG_LEVEL: "warn",
      CORS_ORIGINS: "https://shop.example.mg, https://admin.example.mg",
      TRUST_PROXY: "1",
      BODY_LIMIT_KB: "20",
      SWAGGER_ENABLED: "true",
    });
    expect(config).toEqual({
      nodeEnv: "production",
      host: "127.0.0.1",
      port: 8080,
      logLevel: "warn",
      corsOrigins: ["https://shop.example.mg", "https://admin.example.mg"],
      trustProxy: 1,
      bodyLimitKb: 20,
      isSwaggerEnabled: true,
    });
  });

  it("accepts the limits of the valid ranges", () => {
    expect(parseConfig({ PORT: "1", BODY_LIMIT_KB: "1" })).toMatchObject({
      port: 1,
      bodyLimitKb: 1,
    });
    expect(parseConfig({ PORT: "65535", BODY_LIMIT_KB: "10240" })).toMatchObject({
      port: 65535,
      bodyLimitKb: 10240,
    });
  });

  it("treats an empty variable as not set", () => {
    expect(parseConfig({ PORT: "", CORS_ORIGINS: "", LOG_LEVEL: "" }).port).toBe(3000);
  });

  it("ignores variables it does not know", () => {
    expect(parseConfig({ DATABASE_URL: "postgresql://x", PATH: "/bin" })).toEqual(parseConfig({}));
  });

  describe("Swagger", () => {
    it("is off by default in production", () => {
      expect(parseConfig({ NODE_ENV: "production" }).isSwaggerEnabled).toBe(false);
    });

    it("is off by default when NODE_ENV is not set", () => {
      expect(parseConfig({}).isSwaggerEnabled).toBe(false);
    });

    it.each(["development", "test"])("is on by default when NODE_ENV is %s", (nodeEnv) => {
      expect(parseConfig({ NODE_ENV: nodeEnv }).isSwaggerEnabled).toBe(true);
    });

    it("can be switched on in production and off in development", () => {
      expect(
        parseConfig({ NODE_ENV: "production", SWAGGER_ENABLED: "true" }).isSwaggerEnabled,
      ).toBe(true);
      expect(
        parseConfig({ NODE_ENV: "development", SWAGGER_ENABLED: "false" }).isSwaggerEnabled,
      ).toBe(false);
    });
  });

  describe("trust proxy", () => {
    it("is off by default", () => {
      expect(parseConfig({}).trustProxy).toBe(false);
    });

    it("accepts the explicit word false", () => {
      expect(parseConfig({ TRUST_PROXY: "false" }).trustProxy).toBe(false);
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
      const config = parseConfig({ CORS_ORIGINS: " https://a.example.mg ,https://b.example.mg, " });
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
