import { randomUUID } from "node:crypto";
import type { Options } from "pino-http";
import type { AppConfig } from "../config/app-config.js";

/**
 * Headers that carry credentials. The request serializer below logs no header at all, so this is
 * a second barrier: whatever logs a request or a response later (an error, a debug line) is
 * redacted too.
 */
export const REDACTED_HEADER_PATHS = [
  "req.headers.authorization",
  "req.headers.cookie",
  'req.headers["x-api-key"]',
  'req.headers["x-tracking-token"]',
  'res.headers["set-cookie"]',
] as const;

const REQUEST_ID_HEADER = "X-Request-Id";

// UUIDs and short opaque ids. Strict on purpose: the id is copied into every log line and into
// a response header, so a client must not be able to inject anything else.
const REQUEST_ID_PATTERN = /^[A-Za-z0-9_-]{8,64}$/;

export function isValidRequestId(value: unknown): value is string {
  return typeof value === "string" && REQUEST_ID_PATTERN.test(value);
}

/** Reuses the id sent by a caller (a proxy, a front end) when it is safe, otherwise makes one. */
export function resolveRequestId(incoming: string | readonly string[] | undefined): string {
  return isValidRequestId(incoming) ? incoming : randomUUID();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

// The route template, never the real path: a path parameter must not reach the logs. Express knows the template only once the
// handler matched, so this is read when the response is finished (see customProps below).
// A catch-all template (Nest's handler of unknown routes) says nothing about the request.
function readRoute(request: unknown): string {
  const route = isRecord(request) ? request.route : undefined;
  const path = isRecord(route) ? route.path : undefined;
  return typeof path === "string" && !path.includes("*") ? path : "unmatched";
}

// Only what is needed to follow a request. No URL, no query string, no headers and no client
// address: all of them can hold personal data or tokens.
function serializeRequest(request: unknown): Record<string, unknown> {
  return isRecord(request) ? { id: request.id, method: request.method } : {};
}

function serializeResponse(response: unknown): Record<string, unknown> {
  return isRecord(response) ? { statusCode: response.statusCode } : {};
}

function pickLevel(statusCode: number, error: Error | undefined): "error" | "warn" | "info" {
  if (error !== undefined || statusCode >= 500) {
    return "error";
  }
  return statusCode >= 400 ? "warn" : "info";
}

export function buildPinoHttpOptions(config: AppConfig): Options {
  return {
    level: config.logLevel,
    genReqId: (request, response) => {
      const id = resolveRequestId(request.headers["x-request-id"]);
      response.setHeader(REQUEST_ID_HEADER, id);
      return id;
    },
    customLogLevel: (_request, response, error) => pickLevel(response.statusCode, error),
    redact: { paths: [...REDACTED_HEADER_PATHS], censor: "[redacted]" },
    serializers: { req: serializeRequest, res: serializeResponse },
    // pino-http also calls this when the request starts, before any route matched: nothing is
    // added then, the template is only known (and added) at the end.
    customProps: (request, response) =>
      response.writableFinished ? { route: readRoute(request) } : {},
    // Readable logs only in development; everywhere else one JSON object per line.
    ...(config.nodeEnv === "development"
      ? { transport: { target: "pino-pretty", options: { singleLine: true } } }
      : {}),
  };
}
