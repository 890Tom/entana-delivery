# @entana/database

Prisma schema, migrations, seed data and the Prisma client factory for PostgreSQL 18. The data model is described in [`docs/data-model.md`](../../docs/data-model.md).

## What the package exports

Everything comes from `@entana/database` (`src/index.ts`):

- `createPrismaClient(options)` builds a Prisma client on a `pg` pool. It opens no connection: the pool connects on the first query. Options:
  - `connectionString` (required): a `postgres://` or `postgresql://` URL with no space or control character. It is validated and used as it is, with no trimming.
  - `maxConnections`: positive integer, default `10`, at most `50`.
  - `connectionTimeoutMs`: positive integer, default `5000`.
- `InvalidDatabaseOptionsError`, thrown for an invalid option. Its message names the option and never quotes a value, and it carries no `cause`, because the connection string holds the password.
- `classifyDatabaseError(error)` returns the kind of a database failure, one of `DATABASE_ERROR_KINDS`: `unique_violation`, `foreign_key_violation`, `check_violation`, `not_null_violation`, `record_not_found`, `connection`, `timeout`, `unknown`. It never returns, copies or logs the original message. The `DatabaseErrorKind` type is exported too.
- Types: `PrismaClient`, `DatabaseClientOptions`, the model types (`AuditLog`, `AxisPlace`, `Customer`, `CustomerOrder`, `DeliveryAxis`, `OrderEvent`, `OrderItem`, `Place`, `Product`, `Reseller`, `ShopSetting`, `StaffUser`) and the enums of the schema.

## Build and use

The generated Prisma client (`src/generated`) is not committed. `pnpm db:generate` creates it, and Turborepo runs it before `build`, `typecheck`, `test` and `test:integration`, and `pnpm lint` runs it before ESLint.

At runtime the package is consumed from its built `dist/` (the `default` condition of its `exports`), so build it (`pnpm build` from the root) after changing `src`. TypeScript reads the source (the `types` condition), so type checking needs no build.

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

They check the hand-written CHECK constraints (ADR 0007), the unique keys and the foreign keys, with real SQL, and the client factory and the error classification against a real server.

1. Start PostgreSQL: `pnpm db:up`.
2. Run `pnpm test:integration` from the root, or `pnpm --filter @entana/database test:integration`. `DATABASE_URL` is read from the environment, or from the root `.env`.

The suite refuses to run, before any connection, unless `DATABASE_URL` has a single host that is `localhost`, an IPv4 address in 127.0.0.0/8 or `[::1]` (a `host` or `hostaddr` query parameter is refused too). `ENTANA_ALLOW_REMOTE_TEST_DB=1` (exactly `1`) lifts that check and prints a warning: use it only for a database that is meant for tests.

How they stay out of your way:

- Each run creates a database with a random name (`test_` and lowercase hex, so the role needs `CREATEDB`), applies every `migration.sql` in order in it, and drops it at the end, even when a test fails. The run counts the rows of every table of the configured database before and after, and fails if they differ, so your development data is provably untouched (a development server writing to it during the run can fail the check too). Test files run one after another, and a test that deletes rows calls `assertThrowawayDatabase` first.
- Each test runs in a transaction that is rolled back.
- If PostgreSQL is not reachable, the run fails with a message telling you to start it. Nothing is skipped silently, in CI either.

A run interrupted by SIGINT or SIGTERM (Ctrl+C, or turbo stopping the task after a sibling failed) drops its database before it exits. Only a hard kill (SIGKILL, for example `kill -9`) leaves its empty `test_<hex>` database on the server: list it with `\l test_*` in `psql` and remove it with `DROP DATABASE test_<hex>`. In CI the container is thrown away.

A test checks that every CHECK constraint of the schema has a test case. When you add a constraint in a migration, add its case in `tests/integration/check-constraint-cases.ts` (or `admin-check-constraint-cases.ts`, `delivery-check-constraint-cases.ts`), or that test fails.

## Seed data

The seed fills a migrated, empty database with obviously fake demo data: the settings (default values), six products, nineteen places in four delivery axes, five customers, eight orders (with items and events), six resellers, an admin and an inactive driver. It respects every CHECK constraint. Delivery dates are relative to today in the Indian/Antananarivo time zone. The tracking tokens and order codes of the demo orders are fixed, public, fake values (`demo-tracking-token-01`, code `DEMA22`, and so on).

1. Start PostgreSQL and apply the migrations (`pnpm db:up`, then `prisma migrate deploy` or `dev`).
2. Run `pnpm db:seed`.
3. **Note the admin password at the end of the output.** It is random, shown once, never written to a file, and only its Argon2id hash is stored (ADR 0008). The username is `INITIAL_ADMIN_USERNAME` (default `admin`).

Build the packages first (`pnpm build`), otherwise the seed stops with a hint. The seed runs in one transaction: if anything fails, nothing is written. Run it directly with `pnpm`, not through Turborepo, which caches task output.

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
