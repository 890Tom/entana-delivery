# 0013. Database access and health endpoints

- Status: accepted
- Date: 2026-10-06

## Context

The API needs PostgreSQL. Prisma 7 requires a driver adapter (`@prisma/adapter-pg` with `pg`, see [ADR 0006](0006-prisma-7-and-postgresql-18.md)), and the database code has one owner, `packages/database` ([ADR 0005](0005-dedicated-database-package.md)). The API should depend on neither the driver nor Prisma directly. The API is also run by an orchestrator (Docker Compose here, see [ADR 0012](0012-container-image-for-the-api.md)), which needs a way to ask whether the process is alive and whether it can serve requests.

## Decision

- **Client factory in `packages/database`.** `createPrismaClient(options)` builds the client on a `pg` pool. `apps/api` depends on `@entana/database` only (not on `pg` or Prisma) and builds the client in `DatabaseModule`. The package is consumed from its built `dist/` (the `default` condition of its `exports`); `tsconfig.build.json` compiles `src` only.
- **The generated client is not committed.** `db:generate` runs before `build`, `typecheck`, `test` and `test:integration` through Turborepo (`turbo.json`), and before ESLint in `pnpm lint`, because typed linting reads the types of the generated client. Generation needs no database: without `DATABASE_URL`, `prisma.config.ts` uses a placeholder URL.
- **Connection string, checked in two layers.**
  - The API configuration (`app-config.ts`) rejects any whitespace or control character in `DATABASE_URL`.
  - The factory (`pool-settings.ts`) requires the `postgres:` or `postgresql:` scheme and validates the same string it passes to the pool, with no trimming.
  - Errors are fixed messages naming the option, with no `cause`, and never contain the value, which holds the password.
- **Pool settings, from `pool-settings.ts`.** `defaultMaxConnections = 10`, `maxConnectionsLimit = 50` (a larger value is refused at startup), `defaultConnectionTimeoutMs = 5000`. Both are optional options of the factory; the API uses the defaults.
- **Lazy connection.** The pool connects on the first query, so the API starts without a running database and a failure shows up on the first query. An invalid URL still fails at startup.
- **Two health endpoints** (`health.controller.ts`, `readiness.controller.ts`), both `Cache-Control: no-store`.
  - `GET /api/v1/health` is liveness. It never calls the database.
  - `GET /api/v1/health/ready` is readiness.
  - The point of the split is that a database outage should not make an orchestrator restart a process that is healthy: restarting does not repair the database. Liveness stays green and readiness reports the outage.
- **Readiness design** (`readiness.service.ts`).
  - It runs the raw query `SELECT 1`. Raw SQL is acceptable here: Prisma has no model-free ping, and the query touches no table.
  - It waits at most `DEFAULT_READINESS_TIMEOUT_MS = 2000` ms.
  - At most one check query is in flight, and concurrent callers share it.
  - The shared state is cleared when the query settles, not when a caller's timeout fires. A query abandoned by a caller still holds a pool connection, so a burst of checks against a silent database would otherwise exhaust the pool.
  - A failure gives a fixed `503` body that names no component, and one `warn` log line whose reason is one of `timeout`, `connection` or `query`.
- **Compose and CI.**
  - In `docker-compose.yml`, the `api` service waits for the database to be healthy (`depends_on` with `service_healthy`).
  - The database health check connects over TCP (`pg_isready -h 127.0.0.1`): on an empty volume the official image first runs a temporary server that listens only on the Unix socket, so a socket check could pass before the final server is up.
  - The `integration` job in `ci.yml` uses a PostgreSQL service container with throwaway credentials, applies the migrations, and runs the database suite and the API suite as separate steps.

## Consequences

- The API has one database entry point, and the driver and Prisma stay in one package.
- A database outage is visible on the readiness endpoint and does not affect liveness.
- Readiness checks hold at most one pool connection at a time, because only one check query is in flight.
- One more package to build before the API can run: Turborepo builds `@entana/database` first (`^build`).
- A generation step is needed everywhere the types are read: lint, typecheck, tests, the Dockerfile and CI.
- Known debt: the API integration suite reads the migration files of `packages/database` (`tests/integration/support/global-setup.ts`).

Known limitations:

- The rule "the API never imports `pg` or Prisma" is a convention: the `only-api-uses-database` rule in `dependency-cruiser.config.mjs` restricts who may use the database package, and does not apply to `apps/api`. A stricter rule is not in place yet.
- TLS to the database is not configured; it has to be decided at deployment.
- The integration suite of `packages/database` does not refuse non-local hosts, unlike the API suite.
- Readiness has no result caching and no rate limiting; the only protection is that concurrent checks share one in-flight query.

## Alternatives considered

- **The API building its own client with `pg`.** Not chosen: [ADR 0005](0005-dedicated-database-package.md) gives database code one owner, and the API does not depend on `pg` or Prisma today. The architecture rule does not forbid it, so only that convention prevents it.
- **Emitting declaration files instead of pointing `types` at `src`.** Not chosen: with the `types` condition on the source, TypeScript, ESLint, dependency-cruiser and knip never read a build output and cannot read a stale one ([ADR 0010](0010-nestjs-12-esm-express-vitest-with-swc.md), which does the same for `contracts`).
- **Readiness folded into liveness** (one endpoint, or a liveness endpoint that depends on the database). Not chosen, for the reason given under the health endpoints: a database outage would then make an orchestrator restart a healthy process.
