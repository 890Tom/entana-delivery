import { createPrismaClient } from "@entana/database";
import { afterAll, describe, expect, inject, it } from "vitest";
import { FAILING_OPERATIONS } from "./support/failure-cases.module.js";
import { buildForbiddenStrings, findLeak } from "./support/forbidden-strings.js";
import { partOfLine } from "./support/output-parts.js";

// The control of the control: the raw error that PostgreSQL and Prisma really raise for each
// operation is fed to the matcher, which must flag it. If the derived names, or the format of
// those errors, ever changed so that the matcher found nothing in them, the leak checks of the
// main suite would pass while checking nothing: this is the test that would fail first.
describe("the matcher, given the raw error of each real operation", () => {
  const client = createPrismaClient({
    connectionString: inject("throwawayConnectionString"),
    maxConnections: 1,
  });

  afterAll(async () => {
    await client.$disconnect();
  });

  async function rawErrorOf(
    operation: (typeof FAILING_OPERATIONS)[keyof typeof FAILING_OPERATIONS],
  ): Promise<{ text: string; used: string[] }> {
    const used: string[] = [];
    try {
      await operation(client, (value) => {
        used.push(value);
        return value;
      });
    } catch (error) {
      // Only to feed the matcher: this text is never printed.
      return { text: error instanceof Error ? `${error.message}\n${error.stack ?? ""}` : "", used };
    }
    return { text: "", used };
  }

  it.each(Object.entries(FAILING_OPERATIONS))(
    "flags the raw error of %s",
    async (_name, operation) => {
      const { text, used } = await rawErrorOf(operation);
      const forbidden = buildForbiddenStrings({
        databaseName: inject("throwawayDatabase"),
        schemaObjects: inject("schemaObjects"),
        usedValues: used,
        password: "",
        connectionString: "",
      });

      expect(text).not.toBe("");
      expect(findLeak(forbidden, partOfLine("failure log", { msg: text }))).toBeDefined();
    },
  );
});
