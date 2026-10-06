import { describe, expect, it } from "vitest";

import { createPrismaClient } from "../../src/create-prisma-client.ts";
import { requireDatabaseUrl } from "../support/database-url.ts";

describe("createPrismaClient (real PostgreSQL)", () => {
  it("runs a query and disconnects cleanly", async () => {
    const client = createPrismaClient({ connectionString: requireDatabaseUrl() });

    try {
      const rows = await client.$queryRaw<{ one: number }[]>`SELECT 1 AS one`;

      expect(rows).toEqual([{ one: 1 }]);
    } finally {
      await client.$disconnect();
    }
  });
});
