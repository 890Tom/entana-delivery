import { ReadinessTimeoutError } from "../timeout/readiness-timeout-error.js";

/** The only values a readiness log line can carry about a failure. */
export type ReadinessFailureReason = "timeout" | "connection" | "query";

// Socket errors of Node and connection errors of Prisma (P1001: unreachable, P1002: timed out,
// P1008: operation timed out, P1017: server closed the connection).
const CONNECTION_CODES: ReadonlySet<string> = new Set([
  "ECONNREFUSED",
  "ECONNRESET",
  "ENOTFOUND",
  "ETIMEDOUT",
  "EHOSTUNREACH",
  "ENETUNREACH",
  "EPIPE",
  "P1001",
  "P1002",
  "P1008",
  "P1017",
]);

// `kind` of the driver errors that Prisma wraps (see @prisma/driver-adapter-utils).
const CONNECTION_KINDS: ReadonlySet<string> = new Set([
  "DatabaseNotReachable",
  "ConnectionClosed",
  "TlsConnectionError",
  "SocketTimeout",
  "TooManyConnections",
  "AuthenticationFailed",
]);

function isConnectionError(error: object): boolean {
  const hasConnectionCode =
    "code" in error && typeof error.code === "string" && CONNECTION_CODES.has(error.code);
  const hasConnectionKind =
    "kind" in error && typeof error.kind === "string" && CONNECTION_KINDS.has(error.kind);
  return hasConnectionCode || hasConnectionKind;
}

// A raw query that failed to connect reaches us as a Prisma P2010 whose `meta` holds the driver
// error: the real reason is one level down.
function readDriverError(error: object): unknown {
  if (!("meta" in error) || typeof error.meta !== "object" || error.meta === null) {
    return undefined;
  }
  return "driverAdapterError" in error.meta ? error.meta.driverAdapterError : undefined;
}

function readNestedErrors(error: object): unknown[] {
  const nested: unknown[] = [readDriverError(error)];
  if ("cause" in error) {
    nested.push(error.cause);
  }
  if (error instanceof AggregateError) {
    const errors: unknown[] = error.errors;
    nested.push(...errors);
  }
  return nested;
}

// A host with several addresses fails with an AggregateError, and a driver can wrap the socket
// error as a cause: both are searched. `seen` stops a cause that loops back.
function hasConnectionCode(error: unknown, seen: Set<unknown>): boolean {
  if (typeof error !== "object" || error === null || seen.has(error)) {
    return false;
  }
  seen.add(error);
  if (isConnectionError(error)) {
    return true;
  }
  return readNestedErrors(error).some((nested) => hasConnectionCode(nested, seen));
}

/**
 * Sorts a failure into a closed set, for the log. It reads the type and the `code` of the error,
 * never its message, its stack or its host and port: they can hold a host, a user or SQL.
 */
export function classifyReadinessFailure(error: unknown): ReadinessFailureReason {
  if (error instanceof ReadinessTimeoutError) {
    return "timeout";
  }
  return hasConnectionCode(error, new Set()) ? "connection" : "query";
}
