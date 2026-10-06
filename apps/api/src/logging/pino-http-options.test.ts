import { IncomingMessage, ServerResponse } from "node:http";
import { Socket } from "node:net";
import { Writable } from "node:stream";
import { pino } from "pino";
import { describe, expect, it } from "vitest";
import { parseConfig } from "../config/app-config.js";
import {
  REDACTED_HEADER_PATHS,
  buildPinoHttpOptions,
  isValidRequestId,
  resolveRequestId,
} from "./pino-http-options.js";

const fakeDatabaseUrl = "postgresql://test:test@localhost:5432/test";

function capture(): { stream: Writable; lines: () => string[] } {
  const chunks: string[] = [];
  const stream = new Writable({
    write(chunk: Buffer, _encoding, done): void {
      chunks.push(chunk.toString());
      done();
    },
  });
  return { stream, lines: () => chunks };
}

describe("request id", () => {
  it.each([
    "7d9f1c3e-5b1a-4c55-9a43-2f6c0b6d8e21",
    "abc12345",
    "front_end-request-0001",
    "A".repeat(64),
  ])("reuses the incoming id %s", (value) => {
    expect(resolveRequestId(value)).toBe(value);
  });

  it.each([
    "short",
    "A".repeat(65),
    "has space in it",
    "semi;colon-id-123",
    "line\nbreak-123456",
    "<script>alert(1)</script>",
    "",
  ])("generates a new id instead of the unsafe incoming id %j", (value) => {
    const id = resolveRequestId(value);
    expect(id).not.toBe(value);
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it("generates a new id when the header is absent or repeated", () => {
    expect(isValidRequestId(resolveRequestId(undefined))).toBe(true);
    expect(isValidRequestId(resolveRequestId(["abcdefgh12", "abcdefgh34"]))).toBe(true);
    expect(resolveRequestId(["abcdefgh12", "abcdefgh34"])).not.toBe("abcdefgh12");
  });

  it("generates a different id each time", () => {
    expect(resolveRequestId(undefined)).not.toBe(resolveRequestId(undefined));
  });
});

describe("redaction", () => {
  it("hides the headers that carry credentials, whatever logs them", () => {
    const { stream, lines } = capture();
    const logger = pino(
      { redact: { paths: [...REDACTED_HEADER_PATHS], censor: "[redacted]" } },
      stream,
    );

    logger.info({
      req: {
        headers: {
          authorization: "Bearer token-123",
          cookie: "session=abc",
          "x-api-key": "key-456",
          accept: "application/json",
        },
      },
      res: { headers: { "set-cookie": "session=def" } },
    });

    const output = lines().join("");
    for (const secret of ["token-123", "session=abc", "key-456", "session=def"]) {
      expect(output).not.toContain(secret);
    }
    expect(output).toContain("application/json");
    expect(output).toContain("[redacted]");
  });
});

describe("buildPinoHttpOptions", () => {
  it("uses the configured level", () => {
    expect(
      buildPinoHttpOptions(
        parseConfig({
          DATABASE_URL: fakeDatabaseUrl,
          LOG_LEVEL: "warn",
        }),
      ).level,
    ).toBe("warn");
  });

  it("writes readable logs only in development", () => {
    expect(
      buildPinoHttpOptions(
        parseConfig({
          DATABASE_URL: fakeDatabaseUrl,
          NODE_ENV: "development",
        }),
      ).transport,
    ).toMatchObject({
      target: "pino-pretty",
    });
    expect(
      buildPinoHttpOptions(
        parseConfig({
          DATABASE_URL: fakeDatabaseUrl,
          NODE_ENV: "production",
        }),
      ).transport,
    ).toBeUndefined();
    expect(
      buildPinoHttpOptions(
        parseConfig({
          DATABASE_URL: fakeDatabaseUrl,
          NODE_ENV: "test",
        }),
      ).transport,
    ).toBeUndefined();
  });
});

describe("what an access log line contains", () => {
  const options = buildPinoHttpOptions(parseConfig({ DATABASE_URL: fakeDatabaseUrl }));

  function buildRoute(request: Record<string, unknown>, isFinished: boolean): unknown {
    const incoming = Object.assign(new IncomingMessage(new Socket()), request);
    const response = new ServerResponse(incoming);
    Object.defineProperty(response, "writableFinished", { value: isFinished });
    const { customProps } = options;
    if (typeof customProps !== "function") {
      throw new Error("customProps is expected to be a function.");
    }
    return customProps(incoming, response);
  }

  it("names the route template once the response is finished", () => {
    expect(buildRoute({ route: { path: "/api/v1/orders/:id" } }, true)).toEqual({
      route: "/api/v1/orders/:id",
    });
  });

  it("adds nothing before the response is finished, when no handler matched yet", () => {
    expect(buildRoute({ route: { path: "/api{/*splat}" } }, false)).toEqual({});
  });

  it.each([
    ["no route", {}],
    ["a catch-all route", { route: { path: "/*splat" } }],
    ["a route without a path", { route: {} }],
  ])("says unmatched when there is %s", (_name, request) => {
    expect(buildRoute(request, true)).toEqual({ route: "unmatched" });
  });

  it("serializes a request to its id and method only", () => {
    const serialized: unknown = options.serializers?.req?.({
      id: "abc",
      method: "GET",
      url: "/api/v1/orders/track/secret",
      headers: { authorization: "Bearer x" },
      remoteAddress: "203.0.113.7",
    });
    expect(serialized).toEqual({ id: "abc", method: "GET" });
  });

  it("serializes a response to its status code only", () => {
    const serialized: unknown = options.serializers?.res?.({
      statusCode: 201,
      headers: { "set-cookie": "session=x" },
    });
    expect(serialized).toEqual({ statusCode: 201 });
  });

  it("serializes something that is not an object to nothing", () => {
    expect(options.serializers?.req?.(undefined)).toEqual({});
    expect(options.serializers?.res?.("text")).toEqual({});
  });

  it.each([
    [200, undefined, "info"],
    [404, undefined, "warn"],
    [500, undefined, "error"],
    [200, new Error("failed"), "error"],
  ] as const)("logs status %i with error %s at level %s", (statusCode, error, level) => {
    const incoming = new IncomingMessage(new Socket());
    const response = Object.assign(new ServerResponse(incoming), { statusCode });
    expect(options.customLogLevel?.(incoming, response, error)).toBe(level);
  });
});
