# @entana/api

NestJS 12 (ESM, Express) API. For now: a liveness endpoint and the production basics
(configuration, logging, errors, security headers, API documentation). No database yet.

## Run it

```sh
cp ../../.env.example ../../.env   # once
pnpm --filter @entana/api dev      # watch mode, from the repository root
pnpm build && pnpm --filter @entana/api start
```

- `GET /api/v1/health` — liveness (`status`, `service`, `version`, `uptimeSeconds`), never cached.
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

After editing `packages/contracts`, run `pnpm --filter @entana/contracts build` (or restart
`pnpm dev` from the root): the API loads the compiled output of `contracts`, not its source.

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

## Dependency injection

Nest injects by reading the constructor parameter types at runtime (`emitDecoratorMetadata`). A
class that is injected must therefore be imported as a **value** (`import { HealthService } from`),
never with `import type`: the compiler and ESLint accept both, but with `import type` Nest cannot
resolve the dependency and the application fails at startup (`UnknownDependenciesException`).
The end-to-end tests boot the real module, so they catch it. Interfaces and tokens injected with
`@Inject(TOKEN)` are the opposite: `import type` for the interface, a value import for the token.

## Tests

`pnpm --filter @entana/api test` runs the unit tests and the end-to-end tests (Supertest, no
database). `test:e2e` runs the end-to-end tests alone, and `test:coverage` adds the 90% coverage
floors. The end-to-end tests also use test-only routes (`tests/e2e/support/probe.module.ts`) to
exercise validation and errors; the real application has none, and a test checks it.

Tests need the compiled `@entana/contracts` (Turborepo builds it first when you run `pnpm test`
from the root).
