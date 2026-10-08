# @entana/api

NestJS 12 (ESM, Express) API. For now: liveness and readiness endpoints, access to PostgreSQL
through `@entana/database`, the public catalogue (`GET /api/v1/products`), and the production
basics (configuration, logging, errors, security headers, API documentation).

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
its message and stack are written to the logs only. Every error answer carries
`Cache-Control: no-store`.

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

## Catalogue endpoint

`GET /api/v1/products` is public (no authentication, no query parameter). It returns every active
product, in display order (position, then name, then id), as `{ "products": [...] }`: the shape is
`productListResponseSchema` of `@entana/contracts`, unchanged. Each product has `id`, `name`,
`description` (`null` when blank), `priceAr` (integer ariary), `available` and
`image: { key, alt }`. An unavailable product is still listed, with `available: false`; the
internal `sku` is never selected (see [ADR 0016](../../docs/adr/0016-public-product-catalogue.md)). An empty catalogue answers `{ "products": [] }`.

- **No pagination:** the whole catalogue is returned on purpose, for a shop-sized catalogue.
- **Cache:** `Cache-Control: public, max-age=30` on a success (the constant is
  `CATALOG_CACHE_CONTROL`; the value is a product decision to confirm). Every error answer carries
  `Cache-Control: no-store`.
- **Errors:** an unreachable database is the fixed `503` of "Database errors" below; anything else,
  including a corrupt row, is the generic `500` (no product name, id or column in the answer, and
  none in the logs).

## Order endpoint

`POST /api/v1/orders` creates an order. Public, no account. Documented in the OpenAPI page
(`/api/docs`, development and test only).

**How to call it.** `Content-Type: application/json` (anything else is a 415) and an
`Idempotency-Key` header holding a uuid, sent **once** (upper or lower case, it is stored in lower case; a missing, malformed or repeated
header is a 400 that names only the header). The client generates both the idempotency key (once per order,
reused to retry) and the tracking token (32 random bytes in base64url, 43 characters): the API
stores only the hash of the token and never returns it. The body is the `createOrderRequestSchema`
of `@entana/contracts`; it is strict, so a price, a total, a fee or a status sent by the client is
a 400. The server prices the order from the database.

On success: `201` with `{ orderCode, status, totalAr, createdAt }` and `Cache-Control: no-store`. A
replay (same key, same request) answers the same `201` and the same body with
`Idempotent-Replayed: true`, and writes nothing.

| Status | When                                                                                                | Body                                                             |
| ------ | --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| 400    | Invalid body, invalid phone number or invalid `Idempotency-Key`                                     | `errors[]` with the JSON Pointer of each invalid field, no value |
| 403    | The customer is blocked                                                                             | Fixed, the same for every refusal of this kind                   |
| 409    | The key was already used for another request (another body **or** another phone)                    | Fixed, the same for every conflict                               |
| 413    | Body larger than `BODY_LIMIT_KB`                                                                    | Fixed                                                            |
| 415    | Content type is not `application/json`                                                              | Fixed                                                            |
| 422    | A product is unknown, inactive or unavailable (one answer for all three), or the order is too large | Fixed, plus `productIds`: only the ids the client sent           |
| 429    | More than 20 requests per address in 10 minutes, or a sixth order in an hour for one phone          | The same body and the same headers for both, `Retry-After: 600`  |
| 500    | Creation failed after several attempts, or any unexpected error                                     | Generic                                                          |
| 503    | The database is unreachable                                                                         | Fixed                                                            |

No answer, log line or error repeats a value the client sent: not the phone number, the name, the
note, the landmark, the coordinates, the tracking token or the name of an unknown property. A
validation error carries a fixed text and a pointer only; an unknown property is reported on its
parent object (pointer `""`).

**Client address and `TRUST_PROXY`.** The per-address limit counts `request.ip`. Without
`TRUST_PROXY` that is the address of the TCP peer, so **behind a reverse proxy every client shares
the proxy's address, and after 20 orders in 10 minutes the API refuses everybody**. Behind one
proxy set `TRUST_PROXY=1` (see Configuration) and make sure the proxy overwrites or appends
`X-Forwarded-For`. An IPv4-mapped IPv6 address (`::ffff:a.b.c.d`) counts as the IPv4 address, and
an IPv6 address counts by its /64 prefix. The address is never logged.

**Limits, stated plainly.**

- The per-phone limit (5 orders per hour) can be used to block a known number: anybody who knows a
  phone number can send it five orders and keep it refused. It is a trade-off of an account-less
  service.
- A `429` received from an address that is not itself limited implies that the phone number has
  reached its limit (five recent orders). Both `429` answers are identical, body and headers, with
  the same fixed `Retry-After: 600`. Timing is still a distinguisher (the address refusal needs no
  database work), so do not rely on the two being indistinguishable. `600` understates the phone
  block, which lasts up to an hour: a client that obeys it may be refused again.
- The per-address limit is in memory and per instance: it is lost on restart, and several
  instances each count on their own (a shared store would be needed). It tracks at most 10 000
  addresses and evicts the least recently seen one that is not limited. If every tracked address is
  limited, a new address is allowed through untracked (a documented trade-off: refusing it would let
  a flood lock everybody out); the per-phone limit and the idempotency still apply. IPv6 is counted
  per /64 prefix.
- A request refused by the address limiter never reaches the access logger, so it has no access
  log line: it writes one fixed warning line (`order_creation_address_limited`), without address,
  header, query or body.
- Deployment item: nothing warns at startup when `TRUST_PROXY` is left at `false` in production
  behind a proxy (see above). Check it when you deploy.
- The `409`, `403` and `422` answers say whether a key is in use, a customer is blocked, or a
  product id is unusable: they are the only status codes beyond the above that reveal anything.

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
exercise validation and errors; the real application has none, and a test checks it. A validation
error carries a pointer and a fixed detail only, never a key, a value or a message from the request. The same holds for every HTTP error: its
detail is a fixed sentence chosen by status, and `instance` is the request path only when it is made of
URL path characters (at most 200, no query or fragment), otherwise `about:blank`.

`test:integration` needs a running database: start it with `pnpm db:up`. `DATABASE_URL` is read
from the environment or from the root `.env`. The suite creates a throwaway database on the same
server (`test_` and lowercase hex, so the role needs `CREATEDB`), applies the migrations in it and
drops it at the end. It refuses to run, before any connection, when the host of `DATABASE_URL` is
not `localhost`, `127.0.0.1` or `[::1]`; setting `ENTANA_ALLOW_REMOTE_TEST_DB=1` lifts that check,
only for a database meant for tests. It counts the rows of every table of the configured database
before and after the run, and fails if they differ (so a development server writing to that
database during the run can fail it too). Test files run one after another, and a test that
empties or deletes rows calls `assertThrowawayDatabase` first; the setup checks the name of the
database it creates and drops itself. A run interrupted by SIGINT or SIGTERM (Ctrl+C, or turbo stopping the task after a sibling
failed) drops its database before it exits. Only a hard kill (SIGKILL, for example `kill -9`)
leaves its empty `test_<hex>` database: list it with `\l test_*` in `psql` and remove it with
`DROP DATABASE`.

Tests need the compiled `@entana/contracts` and `@entana/database` (Turborepo builds them first
when you run the commands from the root).

## Known follow-ups

- `instance` of an error is the raw request path (see "Errors"). When the tracking route is added,
  its task must build `instance` from the route template when a route matched, and include an e2e
  test proving that a distinctive fake token in the path appears in no body, header or log.
