# @entana/api

NestJS 12 (ESM, Express) API. For now: liveness and readiness endpoints, access to PostgreSQL
through `@entana/database`, and the production basics (configuration, logging, errors, security
headers, API documentation). There is no business endpoint yet.

## Run it

```sh
cp ../../.env.example ../../.env   # once
pnpm --filter @entana/api dev      # watch mode, from the repository root
pnpm build && pnpm --filter @entana/api start
```

See [Health endpoints](#health-endpoints) for the two probes.

- `GET /api/docs` — Swagger UI, and `/api/docs-json` the OpenAPI document. Off in production
  unless `SWAGGER_ENABLED=true`.

## Configuration

Environment variables, validated at startup by `src/config/app-config.ts`. If one is invalid the
process prints the names of the invalid variables (never their values) and exits with code 1.
`pnpm dev` and `pnpm start` read the `.env` file at the repository root.

| Variable          | Default                      | Meaning                                                                   |
| ----------------- | ---------------------------- | ------------------------------------------------------------------------- |
| `NODE_ENV`        | `production`                 | `development`, `test` or `production`. Readable logs only in development. |
| `HOST`            | `0.0.0.0`                    | Interface to listen on. See below.                                        |
| `PORT`            | `3000`                       | Port to listen on.                                                        |
| `LOG_LEVEL`       | `info`                       | `fatal`, `error`, `warn`, `info`, `debug`, `trace` or `silent`.           |
| `CORS_ORIGINS`    | empty                        | Allowed browser origins, comma separated. Empty: none.                    |
| `TRUST_PROXY`     | `false`                      | Number of reverse proxies in front of the API. See below.                 |
| `BODY_LIMIT_KB`   | `100`                        | Largest JSON request body, in kilobytes.                                  |
| `SWAGGER_ENABLED` | `development` or `test` only | Serves `/api/docs`.                                                       |
| `DATABASE_URL`    | required                     | PostgreSQL URL. No whitespace or control character. See below.            |

**`NODE_ENV`** defaults to `production`, so that a deployment that forgets it exposes nothing it
should not (no API documentation, strict security headers, JSON logs). `.env.example` sets
`development` for local work.

**`HOST`** defaults to `0.0.0.0` because a process in a container is only reachable from outside
if it listens on every interface (published ports are then chosen by the container runtime).
`.env.example` sets `127.0.0.1` for local development, so that the API is not exposed to the
local network by accident.

**`TRUST_PROXY`** is the number of reverse proxies (nginx, Caddy, a load balancer) between the
internet and the API. Behind one proxy, set `1`: Express then takes the client address from the
`X-Forwarded-For` header that the proxy appends. With `false` that header is ignored. Do not set
a higher number than the real one, and never `true`: a client could then send its own
`X-Forwarded-For` and choose the address that the application (and later rate limiting) sees.
The API never logs the client address.

**`DATABASE_URL`** is required: without it the API exits with code 1 and a message that names the
variable (never its value). It must start with `postgres://` or `postgresql://`, and contain no
whitespace or control character anywhere (a trailing newline from an env file is refused): the
value is used as it is, with no trimming. Percent-encode special characters in the password (`@`
becomes `%40`, `/` becomes `%2F`, `:` becomes `%3A`). The value holds the password, so it is never
logged and never quoted in an error message. The database client connects on the first query, so
the API starts without a running database. A URL that the client refuses (for example a `mysql://`
one) stops the start too, with a message that never quotes the URL.

After editing `packages/contracts`, run `pnpm --filter @entana/contracts build` (or restart
`pnpm dev` from the root): the API loads the compiled output of `contracts`, not its source.

## Container

The production image is built by `apps/api/Dockerfile`. The build context is the repository root.
Local files that are not versioned are kept out of the context by the strict `.dockerignore`.

```sh
docker build -f apps/api/Dockerfile -t entana-api .
```

Run it with literal values:

```sh
docker run -d --name entana-api -p 3000:3000 \
  -e NODE_ENV=production -e HOST=0.0.0.0 -e PORT=3000 \
  -e DATABASE_URL=postgresql://user:password@host:5432/database \
  entana-api
```

`HOST` must be `0.0.0.0` inside a container. With `127.0.0.1` the API is unreachable through the
published port, even though Docker reports the container healthy: the health check runs inside the
container and cannot see the problem. The values are literal on purpose, so that a `HOST` or
`PORT` exported in your shell cannot change them.

With Compose, the `api` service is behind the `app` profile, so a plain `docker compose up`
starts only the database:

```sh
docker compose --profile app up -d --build api
```

The `api` service waits for the database health check to pass before it starts. Its
`DATABASE_URL` is built by Compose from the `POSTGRES_*` variables, with the host `postgres`, and
Compose cannot percent-encode: the database password must use only letters, digits and `-`, `.`,
`_`, `~` for this service.

Compose reads the whole file, so the `.env` file must set `POSTGRES_USER`, `POSTGRES_PASSWORD`
and `POSTGRES_DB` even to start only the API (copy `.env.example`). It sets `NODE_ENV`, `HOST` and
`PORT` itself and reads three optional variables from the shell or `.env`: `API_PORT` (port
published on the host, default `3000`), `LOG_LEVEL` (default `info`) and `CORS_ORIGINS` (default
empty: no cross-origin browser is allowed).

**Health check.** Every 30 seconds (3 seconds timeout, 10 seconds start period, 3 retries) Node
requests `http://127.0.0.1:$PORT/api/v1/health` and fails if the answer is not successful or takes
more than 2 seconds. The image has no `curl`, so Node performs the request.

**Variables set by the image:** `NODE_ENV=production`, `HOST=0.0.0.0` and `PORT=3000`. Every
other variable of the table above keeps its default. The process runs as the `node` user and
starts with `node dist/main.js`.

## Logs

One JSON object per line on stdout (pino). Each request gets an id, returned in the
`X-Request-Id` header. An incoming `X-Request-Id` is reused only if it is 8 to 64 letters, digits,
`-` or `_`; otherwise a UUID is generated. The access log holds the method, the status, the
response time and the route **template** (`/api/v1/orders/track/:token`), never the real path, the
query string, the headers or the client address. `Authorization`, `Cookie` and `Set-Cookie` are
also redacted wherever they would be logged. An unexpected error is logged with its type and
stack frames but never its message, which could hold personal data.

## Errors

Every error is `application/problem+json` (RFC 9457) with `type`, `title`, `status`, `detail` and
`instance` (the path, without the query string). A validation error adds `errors`, a list of
`{ pointer, detail }` (JSON Pointer to the invalid field). An unexpected error is a generic 500:
its message and stack are written to the logs only.

## Health endpoints

Both answer with `Cache-Control: no-store`.

- `GET /api/v1/health` is the liveness probe (`status`, `service`, `version`, `uptimeSeconds`). It
  never calls the database, so it stays green while the database is down.
- `GET /api/v1/health/ready` is the readiness probe. It runs one trivial query (`SELECT 1`) and
  waits at most 2000 ms for the answer. On success: `200` with `{"status":"ready"}`. Otherwise a
  fixed `503` `application/problem+json` body (`detail`: "The service is not ready.") that names
  no component and does not say that a database is involved. At most one check query is in flight
  at a time: calls that arrive while it is pending share its result. A failure is logged once,
  with a reason that is only `timeout`, `connection` or `query`.

## Database errors

A database failure that reaches the error filter is answered with a fixed status and a fixed
sentence, whatever the cause:

| Kind of failure                               | Status | `detail`                                                     |
| --------------------------------------------- | ------ | ------------------------------------------------------------ |
| Database unreachable, or connection timed out | 503    | The service is temporarily unavailable.                      |
| Unique or foreign key violation               | 409    | The request conflicts with the current state of the service. |
| Record not found                              | 404    | The requested resource was not found.                        |
| CHECK or NOT NULL violation, any other error  | 500    | An unexpected error occurred.                                |

Responses and logs never contain a table, a column, a constraint, SQL or a value: the log line of a
classified failure holds the kind of failure and nothing else. The kinds come from
`classifyDatabaseError` of `@entana/database`; the mapping is in
`src/errors/database-failure/database-failure-mapping.ts`.

`apps/api` never imports `pg` or Prisma: it uses `@entana/database` only. This is enforced, not a
convention: the rule `only-database-package-uses-database-libraries` (`pnpm lint:architecture`, with
`no-restricted-imports` in ESLint for instant feedback) fails on any import of `pg`, `prisma` or
`@prisma/*` outside `packages/database`, in source and in tests.

## Dependency injection

Nest injects by reading the constructor parameter types at runtime (`emitDecoratorMetadata`). A
class that is injected must therefore be imported as a **value** (`import { HealthService } from`),
never with `import type`: the compiler and ESLint accept both, but with `import type` Nest cannot
resolve the dependency and the application fails at startup (`UnknownDependenciesException`).
The end-to-end tests boot the real module, so they catch it. Interfaces and tokens injected with
`@Inject(TOKEN)` are the opposite: `import type` for the interface, a value import for the token.

## Tests

| Command                                      | What it runs                                                    |
| -------------------------------------------- | --------------------------------------------------------------- |
| `pnpm --filter @entana/api test`             | Unit and end-to-end tests (Supertest). No database needed.      |
| `pnpm --filter @entana/api test:e2e`         | The end-to-end tests alone.                                     |
| `pnpm --filter @entana/api test:coverage`    | Same as `test`, plus the coverage floors.                       |
| `pnpm --filter @entana/api test:integration` | The tests that use a real PostgreSQL. Needs a running database. |

The end-to-end tests also use test-only routes (`tests/e2e/support/probe.module.ts`) to
exercise validation and errors; the real application has none, and a test checks it.

`test:integration` needs a running database: start it with `pnpm db:up`. `DATABASE_URL` is read
from the environment or from the root `.env`. The suite creates a throwaway database on the same
server (`test_` and lowercase hex, so the role needs `CREATEDB`), applies the migrations in it and
drops it at the end. It refuses to run, before any connection, when the host of `DATABASE_URL` is
not `localhost`, `127.0.0.1` or `[::1]`; setting `ENTANA_ALLOW_REMOTE_TEST_DB=1` lifts that check,
only for a database meant for tests. It counts the rows of every table of the configured database
before and after the run, and fails if they differ (so a development server writing to that
database during the run can fail it too). Test files run one after another, and a test that
empties or deletes rows calls `assertThrowawayDatabase` first; the setup checks the name of the
database it creates and drops itself. If a run is killed (for example
with `kill -9`), its empty `test_<hex>` database stays: list it with `\l test_*` in `psql` and
remove it with `DROP DATABASE`.

Tests need the compiled `@entana/contracts` and `@entana/database` (Turborepo builds them first
when you run the commands from the root).
