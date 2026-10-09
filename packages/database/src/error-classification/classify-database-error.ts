// Tells the API only the KIND of a database failure, so it can answer with a fixed problem+json.
// Raw errors hold table and constraint names, SQL, host names and parameter values: nothing of
// them is returned, copied or logged here. The result is always a member of DATABASE_ERROR_KINDS.
//
// Observed distinguishing property per kind (Prisma 7.10.0, @prisma/adapter-pg 7.10.0, pg 8.23.1).
// A Prisma error keeps its driver failure in `meta.driverAdapterError.cause`, not in `cause`.
//   unique_violation      Prisma code P2002; driver originalCode 23505 (kind UniqueConstraintViolation)
//   foreign_key_violation Prisma code P2003; driver originalCode 23503 (kind ForeignKeyConstraintViolation)
//   check_violation       Prisma code P2039; driver originalCode 23514 (kind "postgres")
//   not_null_violation    Prisma code P2010 (raw SQL); driver originalCode 23502 (kind NullConstraintViolation)
//   record_not_found      Prisma code P2025, no driver error
//   connection            Prisma code P2010 (raw SQL); driver kind DatabaseNotReachable, no originalCode
//   timeout               plain Error with no code and no meta: the only property is its error text
//                         (see isPoolConnectTimeout, the single exception to the "no error text" rule)
// More `connection` shapes, observed on 2026-10-07 (Prisma 7.10.0, @prisma/adapter-pg 7.10.0,
// pg 8.23.1, Node 24.21.0). With a host name that resolves to several addresses (`localhost`), a
// refused connection does not have the shape of an IP-literal host:
//   connection            string `code` ECONNREFUSED on the error itself, no meta.driverAdapterError
//   connection            Prisma code P1017 (model query) or P2010 (raw query) AND driver kind
//                         ConnectionClosed, a server that accepts the connection and closes it; the
//                         pair is required, never the kind alone, and no other pair was observed
//   connection            string `code` EPIPE on the error itself (meta holds only modelName): the
//                         same event as above, seen once in 200 runs of accept-then-reset. A
//                         deliberate departure from "one real-error integration test per shape":
//                         it cannot be provoked on demand, so only a unit test built from the
//                         observed shape covers it
//   connection            driver originalCode 57P01 (admin_shutdown: the server stopped, or the
//                         backend was terminated, during a query), with whatever Prisma code
// With an IP-literal host or a name that does not resolve (`.invalid`), the refused connection is
// P1001 with kind DatabaseNotReachable, listed above. meta.driverAdapterError.cause then holds the
// host and the port: nothing of meta is ever copied or returned.
// Known limit, not classified: a plain close (not a reset) sometimes (about 1 in 12) gives pg's
// code-less "Connection terminated unexpectedly" Error, with no structural property to read. It
// stays `unknown`: the error text is not matched (the pool timeout is the one exception).
// P2010 and P2039 are generic: they are classified through the driver error, never alone.
// RE-VERIFY every line above when Prisma, the adapter or pg is upgraded: the integration tests
// (tests/integration/classify-database-error.integration.test.ts) provoke each real error.
//
// Properties are read by duck typing, never with instanceof, because class identity breaks when a
// package is loaded twice. The one exception is the Error check of isPoolConnectTimeout, which
// uses the internal class tag for the same reason.

export const DATABASE_ERROR_KINDS = [
  "unique_violation",
  "foreign_key_violation",
  "check_violation",
  "not_null_violation",
  "record_not_found",
  "connection",
  "timeout",
  "unknown",
] as const;

export type DatabaseErrorKind = (typeof DATABASE_ERROR_KINDS)[number];

// The error itself, then at most this many causes.
const MAX_CAUSE_DEPTH = 5;

// Maps, not objects: a lookup with a hostile key such as "constructor" finds nothing.
// Keyed by the string `code` of an error: Prisma codes, and the code of a refused connection.
const ERROR_CODE_KINDS: ReadonlyMap<string, DatabaseErrorKind> = new Map([
  ["P2002", "unique_violation"],
  ["P2003", "foreign_key_violation"],
  ["P2025", "record_not_found"],
  // Not a Prisma code: what Prisma gives, as its `code`, a refused connection to a host name.
  ["ECONNREFUSED", "connection"],
  // Seen once in 200 runs, not reproducible on demand: a unit test only (see the header).
  ["EPIPE", "connection"],
]);

const SQLSTATE_KINDS: ReadonlyMap<string, DatabaseErrorKind> = new Map([
  ["23505", "unique_violation"],
  ["23503", "foreign_key_violation"],
  ["23514", "check_violation"],
  ["23502", "not_null_violation"],
  ["57P01", "connection"],
]);

const DRIVER_KIND_KINDS: ReadonlyMap<string, DatabaseErrorKind> = new Map([
  ["UniqueConstraintViolation", "unique_violation"],
  ["ForeignKeyConstraintViolation", "foreign_key_violation"],
  ["NullConstraintViolation", "not_null_violation"],
  ["DatabaseNotReachable", "connection"],
]);

// A driver kind that counts only under the Prisma codes it was observed with: Prisma code, then
// driver kind. P1017 is a model query, P2010 a raw query, for the same closed connection.
const CONNECTION_CLOSED_KINDS: ReadonlyMap<string, DatabaseErrorKind> = new Map([
  ["ConnectionClosed", "connection"],
]);
const DRIVER_KINDS_BY_PRISMA_CODE: ReadonlyMap<
  string,
  ReadonlyMap<string, DatabaseErrorKind>
> = new Map([
  ["P1017", CONNECTION_CLOSED_KINDS],
  ["P2010", CONNECTION_CLOSED_KINDS],
]);

// Observed with pg 8.23.1 (pg-pool 3.14.0) and Prisma 7.10.0, for a server that accepts the
// connection and never answers. Compared with strict equality, never copied or returned.
const POOL_CONNECT_TIMEOUT_TEXT = "Connection terminated due to connection timeout";

function readProperty(value: unknown, key: string): unknown {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }
  try {
    return Reflect.get(value, key);
  } catch {
    // A getter or a proxy trap that throws is treated as an absent property.
    return undefined;
  }
}

function readString(value: unknown, key: string): string | undefined {
  const property = readProperty(value, key);
  return typeof property === "string" ? property : undefined;
}

function lookup(
  map: ReadonlyMap<string, DatabaseErrorKind> | undefined,
  key: string | undefined,
): DatabaseErrorKind | undefined {
  return key === undefined ? undefined : map?.get(key);
}

// The error, then its causes: bounded, and safe against a cycle.
function collectCauseChain(error: unknown): unknown[] {
  const chain: unknown[] = [];
  const seen = new Set<unknown>();
  let current = error;
  for (let depth = 0; depth <= MAX_CAUSE_DEPTH; depth += 1) {
    if (typeof current !== "object" || current === null || seen.has(current)) {
      break;
    }
    seen.add(current);
    chain.push(current);
    current = readProperty(current, "cause");
  }
  return chain;
}

function classifyDriverError(node: unknown): DatabaseErrorKind | undefined {
  const driverError = readProperty(
    readProperty(readProperty(node, "meta"), "driverAdapterError"),
    "cause",
  );
  const driverKind = readString(driverError, "kind");
  return (
    lookup(SQLSTATE_KINDS, readString(driverError, "originalCode")) ??
    lookup(DRIVER_KIND_KINDS, driverKind) ??
    lookup(DRIVER_KINDS_BY_PRISMA_CODE.get(readString(node, "code") ?? ""), driverKind)
  );
}

function classifyNode(node: unknown): DatabaseErrorKind | undefined {
  return classifyDriverError(node) ?? lookup(ERROR_CODE_KINDS, readString(node, "code"));
}

// The only place that reads an error text, and the last check tried: a pool timeout has no code,
// no meta and no kind (engineering-standards §6 exception). Never used for an error with a code.
function isPoolConnectTimeout(node: unknown): boolean {
  try {
    const isError = Object.prototype.toString.call(node) === "[object Error]";
    return (
      isError &&
      readString(node, "code") === undefined &&
      readProperty(node, "message") === POOL_CONNECT_TIMEOUT_TEXT
    );
  } catch {
    return false;
  }
}

export function classifyDatabaseError(error: unknown): DatabaseErrorKind {
  try {
    const chain = collectCauseChain(error);
    for (const node of chain) {
      const kind = classifyNode(node);
      if (kind !== undefined) {
        return kind;
      }
    }
    return chain.some(isPoolConnectTimeout) ? "timeout" : "unknown";
  } catch {
    return "unknown";
  }
}
