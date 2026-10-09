// Shared by the unit tests in src/ and the tests in tests/: it stays here, outside the build.
// Error shapes as observed in the integration tests (Prisma 7.10.0, pg 8.23.1): a Prisma error
// carries its own `code` and, for a driver failure, `meta.driverAdapterError.cause`. Values are fake.
export function prismaError(
  code: string,
  driverCause?: Record<string, unknown>,
): Record<string, unknown> {
  const meta: Record<string, unknown> = { modelName: "customer" };
  if (driverCause !== undefined) {
    meta.driverAdapterError = { name: "DriverAdapterError", cause: driverCause };
  }
  return { name: "PrismaClientKnownRequestError", code, meta };
}

export const uniqueFailure = prismaError("P2002", {
  kind: "UniqueConstraintViolation",
  originalCode: "23505",
});
