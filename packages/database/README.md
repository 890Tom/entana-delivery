# @entana/database

Prisma schema, migrations and (later) the Prisma client for PostgreSQL 18. The data model is described in [`docs/data-model.md`](../../docs/data-model.md).

## Commands

| Command                 | What it does                                                     |
| ----------------------- | ---------------------------------------------------------------- |
| `pnpm db:generate`      | Generates the Prisma client into `src/generated` (not committed) |
| `pnpm db:validate`      | Validates `prisma/schema.prisma`                                 |
| `pnpm test`             | Unit tests. No database needed                                   |
| `pnpm test:integration` | Tests the migrations against a real PostgreSQL (see below)       |

Run them from the repository root, or with `pnpm --filter @entana/database <command>`.

## Integration tests

They check the hand-written CHECK constraints (ADR 0007), the unique keys and the foreign keys, with real SQL.

1. Start PostgreSQL: `pnpm db:up`.
2. Run `pnpm test:integration`. `DATABASE_URL` is read from the environment, or from the root `.env`.

How they stay out of your way:

- Each run creates a schema with a random name (`test_<hex>`), applies every `migration.sql` in order inside it, and drops it (`CASCADE`) at the end, even when a test fails. Your development data is never touched.
- Each test runs in a transaction that is rolled back.
- If PostgreSQL is not reachable, the run fails with a message telling you to start it. Nothing is skipped silently, in CI either.

If a run is killed (for example with `kill -9`), its `test_<hex>` schema stays in your development database. List leftovers with `\dn test_*` in `psql` and remove them with `DROP SCHEMA test_<hex> CASCADE`. They are harmless, and in CI the container is thrown away.

A test checks that every CHECK constraint of the schema has a test case. When you add a constraint in a migration, add its case in `src/check-constraints.integration.test.ts`, or that test fails.
