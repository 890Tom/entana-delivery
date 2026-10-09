import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../generated/client.ts";
import { InvalidDatabaseOptionsError, toPoolSettings } from "./pool-settings.ts";
import type { DatabaseClientOptions } from "./pool-settings.ts";

// Prisma 7 needs a driver adapter. The adapter owns the pg pool and closes it on $disconnect().
// No connection is opened here: the pool connects on the first query.
export function createPrismaClient(options: DatabaseClientOptions): PrismaClient {
  const settings = toPoolSettings(options);
  try {
    return new PrismaClient({ adapter: new PrismaPg(settings) });
  } catch {
    // The original error may quote the connection string (password included): it is dropped,
    // not chained as `cause`.
    throw new InvalidDatabaseOptionsError("connectionString", "the client could not be built");
  }
}
