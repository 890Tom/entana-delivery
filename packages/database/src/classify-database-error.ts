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
const PRISMA_CODE_KINDS: ReadonlyMap<string, DatabaseErrorKind> = new Map([
  ["P2002", "unique_violation"],
  ["P2003", "foreign_key_violation"],
  ["P2025", "record_not_found"],
]);

const SQLSTATE_KINDS: ReadonlyMap<string, DatabaseErrorKind> = new Map([
  ["23505", "unique_violation"],
  ["23503", "foreign_key_violation"],
  ["23514", "check_violation"],
  ["23502", "not_null_violation"],
]);

const DRIVER_KIND_KINDS: ReadonlyMap<string, DatabaseErrorKind> = new Map([
  ["UniqueConstraintViolation", "unique_violation"],
  ["ForeignKeyConstraintViolation", "foreign_key_violation"],
  ["NullConstraintViolation", "not_null_violation"],
  ["DatabaseNotReachable", "connection"],
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
  map: ReadonlyMap<string, DatabaseErrorKind>,
  key: string | undefined,
): DatabaseErrorKind | undefined {
  return key === undefined ? undefined : map.get(key);
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
  return (
    lookup(SQLSTATE_KINDS, readString(driverError, "originalCode")) ??
    lookup(DRIVER_KIND_KINDS, readString(driverError, "kind"))
  );
}

function classifyNode(node: unknown): DatabaseErrorKind | undefined {
  return classifyDriverError(node) ?? lookup(PRISMA_CODE_KINDS, readString(node, "code"));
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
