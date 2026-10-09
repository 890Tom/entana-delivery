import { describe, expect, inject, it } from "vitest";

import { createPrismaClient } from "../../src/client/create-prisma-client.ts";

describe("createPrismaClient (real PostgreSQL)", () => {
  it("runs a query and disconnects cleanly", async () => {
    const client = createPrismaClient({ connectionString: inject("throwawayConnectionString") });

    try {
      const rows = await client.$queryRaw<{ one: number }[]>`SELECT 1 AS one`;

      expect(rows).toEqual([{ one: 1 }]);
    } finally {
      await client.$disconnect();
    }
  });
});
