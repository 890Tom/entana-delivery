# @entana/database

Prisma schema, migrations and (later) the Prisma client for PostgreSQL 18. The data model is described in [`docs/data-model.md`](../../docs/data-model.md).

## Commands

| Command                  | What it does                                                     |
| ------------------------ | ---------------------------------------------------------------- |
| `pnpm db:generate`       | Generates the Prisma client into `src/generated` (not committed) |
| `pnpm db:validate`       | Validates `prisma/schema.prisma`                                 |
| `pnpm test`              | Unit tests. No database needed                                   |
| `pnpm test:integration`  | Tests the migrations against a real PostgreSQL (see below)       |
| `pnpm db:seed`           | Fills an empty database with fake demo data (see below)          |
| `pnpm db:reset-and-seed` | Erases a local database, then seeds it (see below)               |

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

A test checks that every CHECK constraint of the schema has a test case. When you add a constraint in a migration, add its case in `tests/integration/check-constraints.integration.test.ts`, or that test fails.

## Seed data

The seed fills a migrated, empty database with obviously fake demo data: settings, six products, ten places, three delivery axes, five customers, eight orders (with items and events), six resellers, an admin and an inactive driver. It respects every CHECK constraint. Delivery dates are relative to today in the Indian/Antananarivo time zone. The tracking tokens and order codes of the demo orders are fixed, public, fake values (`demo-tracking-token-01`, code `DEMA22`, and so on).

1. Start PostgreSQL and apply the migrations (`pnpm db:up`, then `prisma migrate deploy` or `dev`).
2. Run `pnpm db:seed`.
3. **Note the admin password at the end of the output.** It is random, shown once, never written to a file, and only its Argon2id hash is stored (ADR 0008). The username is `INITIAL_ADMIN_USERNAME` (default `admin`).

The seed runs in one transaction: if anything fails, nothing is written. Run it directly with `pnpm`, not through Turborepo, which caches task output.

`pnpm db:seed` refuses to run:

- when `NODE_ENV` is `production` (nothing overrides this);
- when the host of `DATABASE_URL` is not local, unless you pass `ALLOW_SEED_NON_LOCAL=true` for that run;
- when any table already has rows.

The admin password is printed to the terminal: run the seed in an interactive terminal, never in CI or in a container whose logs are kept.

To start over:

```sh
ALLOW_DESTRUCTIVE_SEED=true pnpm db:reset-and-seed
```

This is the only destructive command: it empties all 12 tables (the migration history is kept) and seeds again. It refuses, and tells you why, unless all three conditions hold:

- `NODE_ENV` is not `production`.
- `ALLOW_DESTRUCTIVE_SEED` is exactly `true`. Pass it on the command line. If the root `.env` defines it (or `ALLOW_SEED_NON_LOCAL`), the seed refuses to run at all, so a leftover line can never arm a later reset.
- The host of `DATABASE_URL` is local: `localhost`, `127.0.0.1`, `[::1]` or `postgres` (the Docker Compose service). The host is read from the parsed URL and compared exactly. A `host=` or `hostaddr=` query parameter, an empty host (Unix socket), a list of hosts or a value that is not a URL are all refused.

Limits of the check: it reads the name, not the machine behind it. An SSH tunnel to a remote database on `localhost`, or a remote database that answers to the name `postgres`, passes. An unset `NODE_ENV` passes too: the local-host rule is what protects you then.

The seed uses Node's own TypeScript support (`node seed/index.ts`), which is why its imports end in `.ts`.

The seed needs Node 24.7 or later (the first release with `crypto.argon2`, see ADR 0008).
