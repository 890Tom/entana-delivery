import type { DatabaseErrorKind } from "@entana/database";

// The shapes below were observed in packages/database (tests/integration/classify-database-error
// and the header of classify-database-error.ts) with Prisma 7.10.0 and pg 8.23.1. Nothing here is
// guessed: a Prisma error keeps its driver failure in `meta.driverAdapterError.cause`.
function prismaError(code: string, driverCause?: Record<string, unknown>): Record<string, unknown> {
  const meta: Record<string, unknown> = { modelName: "customer" };
  if (driverCause !== undefined) {
    meta.driverAdapterError = { name: "DriverAdapterError", cause: driverCause };
  }
  return { name: "PrismaClientKnownRequestError", code, meta };
}

/** What each kind looks like when Prisma throws it. `unknown` is a plain Error. */
export function buildObservedDatabaseError(kind: DatabaseErrorKind): unknown {
  switch (kind) {
    case "unique_violation":
      return prismaError("P2002", { kind: "UniqueConstraintViolation", originalCode: "23505" });
    case "foreign_key_violation":
      return prismaError("P2003", { kind: "ForeignKeyConstraintViolation", originalCode: "23503" });
    case "check_violation":
      return prismaError("P2039", { kind: "postgres", originalCode: "23514", code: "23514" });
    case "not_null_violation":
      return prismaError("P2010", { kind: "NullConstraintViolation", originalCode: "23502" });
    case "record_not_found":
      return prismaError("P2025");
    case "connection":
      return prismaError("P2010", { kind: "DatabaseNotReachable" });
    case "timeout":
      return new Error("Connection terminated due to connection timeout");
    case "unknown":
      return new Error("something unexpected");
  }
}
