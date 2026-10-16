# @entana/api

NestJS 12 (ESM, Express) API of the customer application and the administration: catalogue,
delivery quote, orders, tracking, resellers, and the administration of orders, products,
resellers, delivery axes and settings. It reaches PostgreSQL only through `@entana/database`, and
its business rules are the pure functions of `@entana/contracts`.

## Run it

```sh
cp ../../.env.example ../../.env   # once
pnpm --filter @entana/api dev      # watch mode, from the repository root
pnpm build && pnpm --filter @entana/api start
```

See [Health endpoints](#health-endpoints) for the two probes.

- `GET /api/docs` — Swagger UI, and `/api/docs-json` the OpenAPI document. Off in production
  unless `SWAGGER_ENABLED=true`.

## Routes

Every route is under `/api/v1`, except the media and the API documentation. Every error is a
problem details answer (see [Errors](#errors)).

**Public** (no account)

| Method | Path                      | Role                                                       |
| ------ | ------------------------- | ---------------------------------------------------------- |
| GET    | `/api/v1/health`          | Liveness probe                                             |
| GET    | `/api/v1/health/ready`    | Readiness probe (one query to the database)                |
| GET    | `/api/v1/instance`        | Public part of the instance configuration                  |
| GET    | `/api/v1/products`        | The catalogue                                              |
| GET    | `/api/v1/resellers`       | The visible resellers                                      |
| GET    | `/api/v1/delivery/zones`  | The places a quote may match, to draw on the map           |
| POST   | `/api/v1/delivery/quote`  | The delivery fee for a point and a number of pieces        |
| POST   | `/api/v1/orders`          | Creates an order (`Idempotency-Key` required)              |
| GET    | `/api/v1/tracking`        | Reads an order with its tracking token                     |
| POST   | `/api/v1/tracking/cancel` | Cancels an order with its tracking token                   |
| POST   | `/api/v1/tracking/lookup` | Finds an order with the phone number and the order code    |
| GET    | `/media/:folder/:file`    | A file of `branding/` or `products/` (also `HEAD`)         |
| GET    | `/api/docs`               | Swagger UI (`/api/docs-json`: the OpenAPI document), if on |

**Administration** (session cookie, except the login and the logout)

| Method | Path                                      | Role                                         |
| ------ | ----------------------------------------- | -------------------------------------------- |
| POST   | `/api/v1/admin/auth/login`                | Signs in, sets the session cookie            |
| POST   | `/api/v1/admin/auth/logout`               | Revokes the session, clears the cookie       |
| GET    | `/api/v1/admin/auth/me`                   | The signed-in admin                          |
| GET    | `/api/v1/admin/orders`                    | One page of orders, with filters and search  |
| GET    | `/api/v1/admin/orders/summary`            | Counters of the list, new orders since an id |
| GET    | `/api/v1/admin/orders/:id`                | One order with its lines and history         |
| POST   | `/api/v1/admin/orders/:id/transitions`    | Moves an order one status forward            |
| GET    | `/api/v1/admin/products`                  | Every product, retired ones included         |
| POST   | `/api/v1/admin/products`                  | Creates a product (retired until published)  |
| PATCH  | `/api/v1/admin/products/:id`              | Changes a product                            |
| PUT    | `/api/v1/admin/products/:id/photo`        | Uploads the photo of a product               |
| PATCH  | `/api/v1/admin/products/:id/availability` | Sets the availability                        |
| POST   | `/api/v1/admin/products/:id/retire`       | Takes a product out of the catalogue         |
| POST   | `/api/v1/admin/products/:id/restore`      | Puts a retired product back                  |
| PUT    | `/api/v1/admin/products/order`            | Sets the display order                       |
| GET    | `/api/v1/admin/resellers`                 | Every reseller                               |
| POST   | `/api/v1/admin/resellers`                 | Creates a reseller                           |
| PATCH  | `/api/v1/admin/resellers/:id`             | Changes a reseller                           |
| POST   | `/api/v1/admin/resellers/:id/verify`      | Marks a reseller verified now                |
| DELETE | `/api/v1/admin/resellers/:id`             | Deletes a reseller for good                  |
| GET    | `/api/v1/admin/delivery/axes`             | Every delivery axis with its places          |
| POST   | `/api/v1/admin/delivery/axes`             | Creates an axis                              |
| PUT    | `/api/v1/admin/delivery/axes/order`       | Sets the rank of every axis                  |
| PUT    | `/api/v1/admin/delivery/axes/:id`         | Replaces an axis and its places              |
| DELETE | `/api/v1/admin/delivery/axes/:id`         | Deletes an axis that no order uses           |
| GET    | `/api/v1/admin/delivery/places`           | The active places                            |
| GET    | `/api/v1/admin/delivery/settings`         | The delivery settings                        |
| PATCH  | `/api/v1/admin/delivery/settings`         | Changes the delivery settings                |
| GET    | `/api/v1/admin/delivery/resolve`          | Tests an address against the axes            |

Each group is described in its own section below.

## Security rules

- **Administration closed by default.** A global guard closes every path under `/api/v1/admin`
  unless a route is marked public (only the login and the logout). Session: an opaque token in an
  `HttpOnly`, `SameSite=Strict` cookie; only its SHA-256 is stored (ADR 0017). A change under
  `/api/v1/admin` must come from an origin of `ADMIN_ALLOWED_ORIGINS`. See
  [Administration](#administration).
- **Tracking token.** Only the SHA-256 of an order's tracking token is stored. The token travels
  in the `X-Tracking-Token` header only, and is redacted from the logs. See
  [Order tracking](#order-tracking).
- **Rate limits** (in memory, per instance): order creation per address and per phone number,
  tracking per address, lookup per address and per phone number, login per address and per
  account. Behind a reverse proxy, `TRUST_PROXY` must be set.
- **Validation at the boundary** with the shared Zod schemas; strict bodies (an unknown field is a
  `400`); a body with a `__proto__`, `constructor` or `prototype` key, deeper than 64 levels or
  with more than 100 000 values is refused; JSON bodies are limited by `BODY_LIMIT_KB`.
- **No personal data in answers or logs** beyond what a route is for: errors carry fixed texts and
  JSON pointers, never a value sent by the client; the access log holds the route template, never
  the real path, the query, the headers or the client address.
- **Headers.** Security headers by helmet; `Cache-Control: no-store` on every error and on the
  order, tracking and administration routes; API documentation off in production unless
  `SWAGGER_ENABLED=true`.

## Configuration

Environment variables, validated at startup by `src/config/app-config.ts`. If one is invalid the
process prints the names of the invalid variables (never their values) and exits with code 1.
`pnpm dev` and `pnpm start` read the `.env` file at the repository root.

| Variable                | Default                                                   | Meaning                                                                           |
| ----------------------- | --------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `NODE_ENV`              | `production`                                              | `development`, `test` or `production`. Readable logs only in development.         |
| `HOST`                  | `0.0.0.0`                                                 | Interface to listen on. See below.                                                |
| `PORT`                  | `3000`                                                    | Port to listen on.                                                                |
| `LOG_LEVEL`             | `info`                                                    | `fatal`, `error`, `warn`, `info`, `debug`, `trace` or `silent`.                   |
| `CORS_ORIGINS`          | empty                                                     | Allowed browser origins, comma separated. Empty: none.                            |
| `ADMIN_ALLOWED_ORIGINS` | required in production; `http://localhost:5174` otherwise | Browser origins that may send a change under `/api/v1/admin`. See Administration. |
| `ADMIN_COOKIE_SECURE`   | `true` in production, `false` otherwise                   | `Secure` flag (and `__Host-` prefix) of the session cookie.                       |
| `TRUST_PROXY`           | `false`                                                   | Number of reverse proxies in front of the API. See below.                         |
| `BODY_LIMIT_KB`         | `100`                                                     | Largest JSON request body, in kilobytes.                                          |
| `SWAGGER_ENABLED`       | `development` or `test` only                              | Serves `/api/docs`.                                                               |
| `DATABASE_URL`          | required                                                  | PostgreSQL URL. No whitespace or control character. See below.                    |
| `MEDIA_ROOT`            | `./media` outside production                              | Absolute path of the media folder. Required in production. See Media.             |
| `INSTANCE_CONFIG_PATH`  | demo file outside production                              | Path of the instance configuration file. Required in production. See below.       |

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

## Instance configuration

The shop itself (name, language, currency, time zone, phone country code, logo file names) is
described by a YAML file, validated at startup by the schema in `packages/contracts`. Start from
`examples/demo/instance.config.yaml`; the real file is `instance.config.yaml` at the repository
root, ignored by git. **It holds no secret**: its public part is served to everybody.

- **Where**: `INSTANCE_CONFIG_PATH`. Outside production, when it is unset, the API uses the demo
  file. In production a missing variable or file stops the API (exit code 1) with a message in
  French. A container must mount the file and set the variable.
- **Validation**: the schema is strict, so an unknown key is an error. An invalid file stops the
  API with the list of the invalid key names, never their values. `phoneCountryCode` is a string
  (`"261"`, between quotes: unquoted, YAML reads a number and the file is refused).
- **Limits**: 64 KiB at most; one YAML document; no custom tag, no merge key, no duplicate key;
  no alias. Logo and icon files are bare names ending in `.png`, `.webp` or `.jpg`
  (never `.svg`), served later under `/media/branding/`.
- **`GET /api/v1/instance`**: public, `Cache-Control: public, max-age=60`. Answers
  `publicInstanceSchema`: `name`, `locale`, `currency`, `phoneCountryCode`, `logoUrl`,
  `appIconUrl`, `contactPhone`, `map`. The time zone and the file names stay on the server. The only error cases are
  those of any route: an invalid file never reaches the route, because the API did not start.
- **`map`** (optional): `styleUrl`, `center { lat, lng }` and `zoom` of the delivery map; every
  field has a default (the OpenFreeMap "liberty" style, Antananarivo, zoom 12), so a file without
  the section still starts. `styleUrl` is an absolute `https` URL or a path of the same origin,
  which lets a shop serve its own tile style; the section is public, so it holds no secret key.
- **`contact`** (optional): `contact.phone` is the shop's own number, published on purpose as
  `contactPhone`. At startup it is checked with the same rule as customers' numbers, using the
  file's `phoneCountryCode`; a refused number stops the API and the message names `contact.phone`,
  never the value. The canonical form (`+261...`) is kept and served; without the section,
  `contactPhone` is `null`. **To note**: that rule accepts Malagasy mobile numbers only, so a
  landline number of the shop is refused. **Deployment**: the strict public schema rejects an
  unknown key, so the client and the API are deployed together.
- **Phone numbers**: the order service reads `phoneCountryCode` from this file. It replaces the
  former phone country code environment variable, which is removed: set `phoneCountryCode` instead.
  For a country with a numbering rule in `packages/contracts` (today `261`: nine national digits, mobile
  prefixes 32, 33, 34, 37, 38 and 39) a number outside the rule is refused with a 400 on `/phone`, and every
  accepted number is stored as `+` and the digits.

## Media

The API serves, read-only, the files of a media folder: `GET` and `HEAD /media/branding/<file>`
and `/media/products/<file>` (no `/api` prefix, no version). No listing, no hidden file, and no
upload on this route (the photos are sent through the administration, see Catalogue).
Only `.png`, `.webp` and `.jpg` are served (never `.svg`), with the content type of the extension,
`X-Content-Type-Options: nosniff`, `Content-Security-Policy: default-src 'none'` and
`Cache-Control: public, max-age=3600` (`public, max-age=31536000, immutable` for a file named
`<uuid>.webp` under `products/`: an uploaded photo gets a new name at every replacement, whereas a
file placed by hand can be replaced under its name). A name that does not match
`^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$`, a missing file and a symbolic link all answer `404`; the name
is checked before the disk is read.

Product photos are sent through `PUT /api/v1/admin/products/:id/photo` (see Catalogue), which writes
`products/<random>.webp`. A file dropped by hand with the `.png`, `.webp` or `.jpg` extension
(`.jpeg` is refused: rename it to `.jpg`) still works. The name of the file is the product's image key.
A product whose key is not such a name makes the catalogue answer the generic `500`.

- **`MEDIA_ROOT`**: absolute path of the folder, holding `branding/` and `products/`. In
  production it is required and must exist, or the API stops with a message that names it. Outside
  production the default is `./media` at the repository root (ignored by git).
- **Compose**: the `api` service mounts the named volume `media` on `/media` and the instance
  file on `/config/instance.config.yaml`, **read-only**. `INSTANCE_CONFIG_FILE` (in `.env`) picks
  the file on the host; the demo file is the default. The image holds no configuration and no
  media, and sets neither variable: a container started without them refuses to start.
- **Put a branding file in** (by hand: the administration uploads product photos only):
  `docker compose cp ./logo.png api:/media/branding/logo.png`, then name it in `branding.logoFile`
  of the instance file. The files must be readable by the user of the image (`node`).
- **Backup**: the `media` volume is data, like the database: back both up together.
  `docker compose down -v` deletes the volume, so the media with it.
- **Volume created earlier with root as owner**: give it back to the image user (`node`) with
  `docker compose run --rm --user root --entrypoint chown api -R node:node /media`. The
  `--entrypoint` is needed because the entrypoint of the image is `node dist/main.js`.

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
  -e ADMIN_ALLOWED_ORIGINS=https://admin.example.mg \
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
empty: no cross-origin browser is allowed). The API refuses to start in production without
`ADMIN_ALLOWED_ORIGINS` (the origins of the administration, see Administration): set it in `.env`.

**Health check.** Every 30 seconds (3 seconds timeout, 10 seconds start period, 3 retries) Node
requests `http://127.0.0.1:$PORT/api/v1/health` and fails if the answer is not successful or takes
more than 2 seconds. The image has no `curl`, so Node performs the request.

**Variables set by the image:** `NODE_ENV=production`, `HOST=0.0.0.0` and `PORT=3000`. Every
other variable of the table above keeps its default. The process runs as the `node` user and
starts with `node dist/main.js`.

### Running migrations from the migrate image

The API image does not apply the migrations. Before the first start, and before starting a new
version, run the migrate image built by `packages/database/Dockerfile` (ADR 0024) on the network
of the database. It exits with `0` when there is nothing to apply.

```sh
docker build -f packages/database/Dockerfile -t entana-migrate .
docker run --rm --network entana-delivery_default \
  -e DATABASE_URL=postgresql://user:password@postgres:5432/database \
  entana-migrate
```

See the [database package](../../packages/database/README.md#running-migrations-from-the-migrate-image).

## Administration

The people of the shop log in to the administration. Everything under `/api/v1/admin/*` is closed
by default: a global guard (`AdminAuthGuard`) decides on the **path** of the request, so a route
added to the area later is closed without anyone having to remember it. A route is open only when
it is marked `@adminPublic()`: the login, and the logout (it answers `200` with or without a
session, so that repeating it is harmless). ADR 0017 records the decisions.

| Route                            | Does                                                                          |
| -------------------------------- | ----------------------------------------------------------------------------- |
| `POST /api/v1/admin/auth/login`  | `{ email, password }`: `200` with `{ id, email, displayName }` and the cookie |
| `POST /api/v1/admin/auth/logout` | Revokes the session, clears the cookie. Always `200`                          |
| `GET /api/v1/admin/auth/me`      | The signed-in admin, or `401`                                                 |

**Who can log in.** A `staff_user` with `role = ADMIN`, `active = true` and an e-mail. A driver, a
disabled account, an unknown e-mail and a wrong password all get the **same `401`** (same status,
same body, no cookie), and the password is verified against a hash of the same cost when the
account does not exist, so the response time does not tell the cases apart.

**The cookie.** Name `__Host-admin_session` (`admin_session` when `ADMIN_COOKIE_SECURE` is off, for
local development over plain HTTP), `HttpOnly; SameSite=Strict; Path=/; Max-Age=604800`, `Secure`
when enabled, no `Domain`. The token is 32 random bytes (CSPRNG) in base64url. Only its SHA-256 is
stored (`admin_session.token_hash`); the token is never in a body, a log or the database.

**Durations.** A session ends 7 days after the login whatever its use, and after 12 hours without
a request. `last_seen_at` is written at most once a minute. Every login opens a new session (a
token is never reused) and deletes, in the same transaction, the sessions that are expired, idle or
revoked: there is no scheduled task.

**Requests that change something.** On a method other than `GET`, `HEAD` or `OPTIONS` under
`/api/v1/admin`, an `Origin` header that is present must be one of `ADMIN_ALLOWED_ORIGINS`
(otherwise `403`). A request with **no** `Origin` that carries the session cookie is refused as
well. The administration is called through a reverse proxy on its own origin (the Vite proxy in
development): **CORS is not configured for it and cookies never cross origins.**

**Limits** (in memory, per instance, same mechanism and memory bound as the tracking limits):
10 attempts per address in 10 minutes (every attempt counts), and 10 **failed** logins per account
(the normalised e-mail) in 15 minutes. Both answer `429` with `Retry-After: 600` and the same body.
The logs hold only a fixed line, never an address or an e-mail. **Risk to know:** the limit per
account is keyed by the e-mail, so anyone who knows an admin's e-mail can lock that account for
15 minutes by sending wrong passwords (the right password is refused too while it is locked). It is
the price of stopping a guess spread over many addresses; the address limit cannot do that.

**Passwords.** 12 to 128 characters, no rule of composition. The policy applies when a password is
set (the script below). The login only requires a string of 1 to 128 characters, so a wrong short
password gets the same `401` as any other wrong password.

**Accounts: the `admin:upsert` script.** Creates an admin or changes its password, and disables an
account. It needs the compiled API (`pnpm build`) and `DATABASE_URL` (read from the root `.env`).

```sh
pnpm --filter @entana/api admin:upsert ana@example.mg --name "Ana"
pnpm --filter @entana/api admin:upsert ana@example.mg --disable
# In the image: docker exec -it <container> node dist/cli/admin-upsert.js ana@example.mg
```

The password is typed twice on the terminal, hidden: it is never an argument, an environment
variable or in the shell history, and the script refuses to run without a terminal. The output is
one fixed line (`Account created.`, `Password updated.`, `Account disabled.`): no e-mail, password
or hash. Changing a password or disabling an account also revokes its sessions. Setting a password
on a disabled account enables it again. A seeded demo admin has no e-mail: create the account with
this script to log in.

### Orders (administration)

Four routes under `/api/v1/admin/orders`, closed by the guard above (`401` without a session). Every
answer carries `Cache-Control: no-store`. OpenAPI tag `admin`, security scheme `adminSession`.

| Route                                       | Does                                                    |
| ------------------------------------------- | ------------------------------------------------------- |
| `GET /api/v1/admin/orders`                  | One page of orders, newest first                        |
| `GET /api/v1/admin/orders/summary`          | The counters of the list screen                         |
| `GET /api/v1/admin/orders/:id`              | One order with its lines and its history                |
| `POST /api/v1/admin/orders/:id/transitions` | Moves the order one step; `200` with the updated detail |

**List.** Parameters, all optional:

| Parameter | Meaning                                                                                                                                   |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `status`  | One status or a comma separated list (`REJECTED,CANCELLED,FAILED`). Each value is checked, a repeated one counts once                     |
| `date`    | `YYYY-MM-DD`, a day of the instance time zone: the orders received that day **or** to be delivered that day                               |
| `q`       | 2 to 50 characters once trimmed. Without a digit: the name typed on the order. Digits only: a part of the phone number (see below)        |
| `zone`    | The id of a delivery axis: the orders of that axis. `none`: the orders outside every axis. An unknown or deactivated axis is not an error |
| `limit`   | 25 by default, 100 at most                                                                                                                |
| `cursor`  | The `nextCursor` of the previous page                                                                                                     |

Any other parameter, a value out of range or a cursor this API did not issue is a `400` that never
repeats the value; `q` is never logged.

The search `q`: a text with a letter and only letters, spaces, `-` and `'` searches `contactName`
("contains", case ignored). A text of digits, `+`, spaces, `-` and `.` searches the phone number
("contains" on the E.164 number): the national zero is dropped (`034 12 345 67` and `+261341234567`
find the same number) and at least 3 digits are needed. Anything else (a letter with a digit, `%`,
`_`) is a `400`. **Limit:** there is no `unaccent` (no PostgreSQL extension), so accents count:
`rene` does not find `René`.

Each item is the row of the detail without the lines, plus `customerName` (the name typed for this
order, `contactName`) and `isNewCustomer` (true when no older order of the same customer exists,
whatever its status, the filters and the page). The answer adds `totalCount`: every order of the
filters, whatever the cursor and the limit.

The list and the detail both carry `deliveryZone`: `{ placeName, axisName }` for an order in an
axis, read from the place and the axis when the order is read (a renamed place shows its current
name), or `null` for an order outside every axis, created before the axes existed included. No
internal id and no colour.

**Summary.** `GET /api/v1/admin/orders/summary?since=<order id>` answers `toProcessCount` (orders
`NEW`), `todayCount` (orders received today in the instance time zone, any status) and, only when
`since` is given, `newSince`: `count` of the orders `NEW` newer than `since` (ids are uuidv7) and
`latest` (`id`, `publicCode`, `customerName`, or `null`). A `since` that is not a uuid is a `400`.

**Detail.** The row, plus lines, delivery fee, note, position, `rejectionReason` (a refusal only)
and the events with their actor. The hash of the tracking token is never in an answer. A malformed
id and an unknown id get the same `404`.

**Transitions.** The body is a strict union on `to`:

| From               | To                 | Body                                                  |
| ------------------ | ------------------ | ----------------------------------------------------- |
| `NEW`              | `CONFIRMED`        | `{ "to": "CONFIRMED", "deliveryDate": "YYYY-MM-DD" }` |
| `NEW`              | `REJECTED`         | `{ "to": "REJECTED", "reason"?: string }`             |
| `CONFIRMED`        | `CANCELLED`        | `{ "to": "CANCELLED", "reason"?: string }`            |
| `CONFIRMED`        | `OUT_FOR_DELIVERY` | `{ "to": "OUT_FOR_DELIVERY" }`                        |
| `OUT_FOR_DELIVERY` | `DELIVERED`        | `{ "to": "DELIVERED" }`                               |
| `OUT_FOR_DELIVERY` | `FAILED`           | `{ "to": "FAILED" }`                                  |

`reason` is 300 characters at most. `deliveryDate` goes from today to 60 days ahead, today read in
the instance time zone. Without a reason the stored text is "Aucun motif précisé." (refusal),
"Annulée par la boutique." (cancellation) or "Livraison non aboutie." (failed delivery): the column
is required by a CHECK constraint. Any other move, an order already in that status and an order
changed in between (a customer's cancellation included) get the same `409`.

**Fee at confirmation.** The confirmation may add `"deliveryFeeAr"`: an integer from 0 to 1 000 000
(`PRODUCT_PRICE_MAX_AR`). Absent, or equal to the recorded fee, nothing about the fee changes. Any
other value is written with the status in the same update: `delivery_fee` takes it, `fee_reason`
becomes `ADJUSTED`, `total_ar` is the frozen lines plus the new fee, and a `FEE_ADJUSTED` event
(actor `STAFF`, the admin's id, payload `{ fromAr, toAr }`) is written in the same transaction.
Only this order changes: the delivery settings and the other orders do not, and the public
tracking shows the adjusted fee and total. The status is checked first (a refused move is a `409`).
A total that the order cannot hold (a signed 32-bit integer) is a `422` of type
`urn:entana:problem:order_total_too_large`, and nothing changes. The amounts are never logged.

### Catalogue (administration)

Eight routes under `/api/v1/admin/products`, closed by the guard above (`401` without a session).
Every answer carries `Cache-Control: no-store`. No rate limiting. OpenAPI tag `admin`.

| Route                                           | Does                                                                |
| ----------------------------------------------- | ------------------------------------------------------------------- |
| `GET /api/v1/admin/products`                    | Every product, retired ones included, by `position` then `id`       |
| `POST /api/v1/admin/products`                   | Creates a product at the end of the list: `201` with the product    |
| `PATCH /api/v1/admin/products/:id`              | Partial change (at least one field, strict): `200` with the product |
| `PUT /api/v1/admin/products/:id/photo`          | Multipart, one file `photo`: `200` with the product                 |
| `PATCH /api/v1/admin/products/:id/availability` | Body `{ "available": boolean }` (strict): `200` with the product    |
| `POST /api/v1/admin/products/:id/retire`        | No body: the product leaves the catalogue; `200` with the product   |
| `POST /api/v1/admin/products/:id/restore`       | No body: active again, unavailable, last; `200` with the product    |
| `PUT /api/v1/admin/products/order`              | Body `{ "ids": uuid[] }` (strict): `200` with the whole list        |

A product is `{ id, name, sku, priceAr, available, availabilityChangedAt, retired, description,
image, imageAlt, position }`. `image` is `{ url }` or `null` (until the photo is sent). `imageAlt` is the
alternative text or `null`, filled even before the photo exists (it is sent first). `retired` is the negation
of the `active` column: a retired product is out of the public catalogue (`GET /api/v1/products`,
which follows `position`) and cannot be ordered (the `422` of the order creation, as for an unknown
product). The orders that hold it are untouched, and a row is never deleted. The public catalogue is
cached for 30 seconds: a change shows up within that delay.

- **Fields.** `name` 1 to 60, `priceAr` integer 1 to 1 000 000, `sku` trimmed and upper-cased,
  `^[A-Z0-9][A-Z0-9-]{1,19}$`, unique (`409`, problem type `urn:entana:problem:sku_taken`),
  `description` 0 to 120 (empty clears it, `null` in the answer), `imageAlt` 1 to 150, `available`
  and `retired` (update only). The creation default is `available: true`.
- **Creation.** A product is always created retired: `retired` is not a field of the creation (`400`
  if sent). The way to publish is: `POST` with `imageAlt`, `PUT` the photo, then `PATCH { "retired": false }`.
- **Update.** One transaction; only the values that differ are written, and nothing at all (no
  audit entry) when none does. `available` can change on a retired product.
  `retired: false` on a retired product restores it: `available = false`, `availabilityChangedAt =
now`, last position, unless `available` is in the same request.
- **Publication rule.** A request that leaves the product visible (`retired: false`, the
  restoration route included) needs a photo and its alternative text: otherwise `422`, problem type
  `urn:entana:problem:product_not_publishable`, fixed detail.
- **Photo.** JPEG, PNG or WebP recognised by content (not by name or announced type), at most 10 MB
  and 40 megapixels. The EXIF rotation is applied, then every metadata is dropped; a transparent PNG
  is flattened on white; the short side must be at least 800 px; the image is cropped to a centred
  square of at most 1000 px (never enlarged) and encoded as WebP, quality 85, lowered by 4 down to
  65 to fit 150 KB (the file is kept at 65 even if heavier). The file is written as
  `products/<random>.webp`, the row is updated, and the previous file is removed after the commit,
  best effort, unless another product still uses it. The product must already have its
  `imageAlt`. The route has no JSON guard; its body limit is its own (10 MB), and no text field is
  accepted next to `photo` (`400`, as for a malformed multipart body).
- **Photo errors** (fixed details, problem `type` in `urn:entana:problem:`): `422 photo_too_small`,
  `415 photo_invalid` (not a recognised format, or not multipart), `413 photo_too_large`,
  `422 photo_invalid` (corrupt, or over 40 megapixels), `422 photo_alt_required`.
- **Availability.** Sets `available` and `availabilityChangedAt` (now). The same value as the
  current one is a `200` that changes nothing and writes no audit entry. A retired product is a `409`.
- **Retire / restore.** Already retired (or already active): `200`, nothing changes, no audit
  entry. Restoring sets `available = false`, `availabilityChangedAt = now` and `position` after the
  last product. A product with no photo or no alternative text cannot be visible
  (`ck_product_photo_when_active`): `422 product_not_publishable`, as for the update.
- **Order.** `ids` must be exactly the products that are not retired, each once; otherwise `409`
  and nothing is written. Positions `0` to `n-1` are written in one transaction. Retired products
  keep their position. The order is not audited.
- **Errors.** An unknown and a malformed id get the same `404` with a fixed detail. A body that is
  not valid or holds another field is a `400`.
- **Audit.** Each real change writes one `audit_log` row in the same transaction: `actor_id` is the
  admin of the session, `entity = "product"`. `product.created` (`diff`: `available`, `retired`),
  `product.updated` (`diff`: `fields`, the names of the changed fields among `name`, `sku`,
  `priceAr`, `description`, `imageAlt`; and `priceAr: { from, to }` when the price changed),
  `product.availability_changed` (`available: { from, to }`, also written by a restoration that
  really changes it), `product.retired`, `product.restored` (`active: { from, to }`) and
  `product.photo_replaced` (`hadPhoto`). No name, description or personal data. The name of the
  uploaded file is never read, kept or logged.

### Resellers (administration)

Five routes under `/api/v1/admin/resellers`, closed by the guard above (`401` without a session).
Every answer carries `Cache-Control: no-store`. No rate limiting. The public list is in [Resellers endpoint](#resellers-endpoint).

| Route                                     | Does                                                                      |
| ----------------------------------------- | ------------------------------------------------------------------------- |
| `GET /api/v1/admin/resellers`             | Every reseller, by `neighborhood` then `name`: `200` with `{ resellers }` |
| `POST /api/v1/admin/resellers`            | Creates a reseller, verified now: `201` with the reseller                 |
| `PATCH /api/v1/admin/resellers/:id`       | Partial change (at least one field, strict): `200` with the reseller      |
| `POST /api/v1/admin/resellers/:id/verify` | No body: verified now, always audited: `200` with the reseller            |
| `DELETE /api/v1/admin/resellers/:id`      | Removed for good (ADR 0020): `204` without a body                         |

A reseller is `{ id, name, neighborhood, landmark, latitude, longitude, consentGiven, visible,
verifiedAt }` (`verifiedAt` is `null` for a row that was never verified). The names of the contract
map to the columns of `reseller`: `neighborhood` is `area`, `landmark` is `landmark_text`,
`latitude` and `longitude` are `lat` and `lng`, `visible` is `active`, and `consentGiven` is whether
`consent_at` is set (giving the consent dates it now, keeping an existing date; withdrawing it clears
the date).

- **Fields.** `name` 1 to 60, `neighborhood` 1 to 40, `landmark` 1 to 120 (required), `latitude` -90
  to 90 and `longitude` -180 to 180 (required, never cleared; together in a `PATCH`), `consentGiven`
  and `visible` (default `false` at creation). Text is trimmed. An unknown field, a missing
  required field or an empty body is a `400`.
- **Visible needs the consent.** `visible: true` without `consentGiven: true` (at creation or
  after the change), and withdrawing the consent of a visible reseller, answer `422` with the
  type `urn:entana:problem:reseller_not_publishable` and a fixed detail. To withdraw the consent, hide
  the reseller in the same request (`visible: false`).
- **Verification.** `isResellerVerificationStale` (contracts) tells a verification older than 90
  days, or missing, that is due again.
- **Audit** (`entity = "reseller"`, same transaction, no name, position or phone): `created`,
  `updated` (`diff.fields`), `consent_changed`, `published`, `unpublished` (before and after of the
  flag), `verified` and `deleted` (the id only). Nothing is written when no value changes.
- An unknown or malformed id is one `404`.

### Delivery (administration)

Nine routes under `/api/v1/admin/delivery`, closed by the guard above (`401` without a session).
Every answer carries `Cache-Control: no-store`. No rate limiting. The places are read only: a place
is created with an axis, and no route changes or removes one. The rules of the fee are those of
`@entana/contracts` (`resolveDeliveryAxis`, `computeDeliveryFee`), never rewritten here.

| Route                                    | Does                                                                     |
| ---------------------------------------- | ------------------------------------------------------------------------ |
| `GET /api/v1/admin/delivery/axes`        | Every axis (active or not) by `rank`: `200` with `{ axes }`              |
| `POST /api/v1/admin/delivery/axes`       | Creates an axis (last rank, smallest free colour): `201` with the axis   |
| `PUT /api/v1/admin/delivery/axes/order`  | Reorders every axis: `200` with `{ axes }` by their new rank             |
| `PUT /api/v1/admin/delivery/axes/:id`    | Replaces `name`, `active` and the places: `200` with the axis            |
| `DELETE /api/v1/admin/delivery/axes/:id` | Deletes an axis that no order uses: `204`                                |
| `GET /api/v1/admin/delivery/places`      | The active places by `name`, not paginated: `200` with `{ places }`      |
| `GET /api/v1/admin/delivery/settings`    | `200` with `{ outOfAxisFeeAr, freeDeliveryMinPieces, outOfAxisMessage }` |
| `PATCH /api/v1/admin/delivery/settings`  | Partial change (at least one field, strict): `200` with the settings     |
| `GET /api/v1/admin/delivery/resolve`     | Tests an address: `200` with `{ match, feeAr, reason }`                  |

- **Axes.** An axis is `{ id, name, rank, color, active, places }`. Its places come in the order
  of their positions, inactive ones included (`active: false`), each with `alsoIn`: the `{ id, name }`
  of the other axes (active or not, by rank) that hold the place, never the axis itself.
- **Writing an axis** (`POST`, `PUT /:id`). Body `{ name, active, color, places }`: `name` 1 to 60 characters
  once trimmed, `color` a `#rrggbb` colour in lower case (two axes may share one), `places` an ordered list of 1 to `MAX_PLACES_PER_AXIS` (50) items, each `{ placeId }`
  (an existing place, listed once) or a new place `{ name, latitude, longitude, radiusM? }`
  (`radiusM` 100 to 3 000, default 500). Positions are 1..n in the order received. One transaction
  holds the new places, the links and the axis; the writes of the axes are serialised by an advisory
  lock, so a rank is never duplicated. A place that leaves an axis is never removed.
  The number of axes is not limited. `PUT` keeps the rank, and accepts an inactive place only if the axis already holds it.
- **Reordering** (`PUT /axes/order`). Body `{ ids }`: every axis exactly once, inactive ones
  included; the ranks become 1..n. Anything else is `422`.
- **Deleting** (`DELETE /axes/:id`). `409` while an order references the axis (deactivate it
  instead); otherwise the axis and its links go, the places stay.
- **Errors** (problem details, fixed `detail`, `type` in `urn:entana:problem:`):
  `delivery_axis_name_taken` and `delivery_place_name_taken` (`409`, without regard to case, also
  inside one body), `delivery_axis_in_use` (`409`),
  `delivery_axis_order_mismatch` and `delivery_place_unavailable` (`422`), an invalid body (`400`,
  an empty list or a `placeId` twice included), an unknown or malformed id (`404`).
- **Audit of the axes** (same transaction, ids, field names and ranks only, never a name or a
  coordinate): `delivery_axis.created`, `delivery_axis.updated` (`diff.fields` among `name`,
  `active`, `color`, `places`), `delivery_place.created` (one per new place), `delivery_axis.reordered`
  (`{ from, to }`, one per axis whose rank changes), `delivery_axis.deleted`. Nothing is written
  when nothing changes.
- **Settings.** `outOfAxisFeeAr` is an integer from 0 to `PRODUCT_PRICE_MAX_AR`,
  `freeDeliveryMinPieces` an integer from 1 to `MAX_FREE_DELIVERY_MIN_PIECES` (an order holds at
  most 30 lines of 99 pieces: 2 970), `outOfAxisMessage` 1 to 200 characters once trimmed. An unknown
  field, an empty body or a value out of bounds is a `400`.
- **Audit** (`delivery_settings.updated`, `entity = "shop_setting"`, same transaction): `diff.fields`
  names the changed fields; the two numbers also carry `{ from, to }`; the message is named, never
  written. The row of the settings has an integer key, so `entity_id` is the fixed uuid
  `00000000-0000-0000-0000-000000000001`. Nothing is written when no value changes.
- **Test of an address.** Query: `latitude` (-90 to 90) and `longitude` (-180 to 180), both required,
  and `pieces` (integer from 1 to 2 970, default 1). Anything else, or a value out of bounds, is a
  `400`. `match` is `null` or `{ axis: { id, name, color }, place: { id, name } }`; `reason` is
  `axis`, `quantity` or `out_of_axis`. The coordinates are not stored or logged.

## Logs

One JSON object per line on stdout (pino). Each request gets an id, returned in the
`X-Request-Id` header. An incoming `X-Request-Id` is reused only if it is 8 to 64 letters, digits,
`-` or `_`; otherwise a UUID is generated. The access log holds the method, the status, the
response time and the route **template** (`/api/v1/tracking/cancel`), never the real path, the
query string, the headers or the client address. `Authorization`, `Cookie`, `X-Api-Key`, `X-Tracking-Token` and `Set-Cookie` are
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
`image: { url, alt }`: `url` is `/media/products/<file>`, built by the API from the product's image key (the raw key is never returned). An unavailable product is still listed, with `available: false`; the
internal `sku` is never selected (see [ADR 0016](../../docs/adr/0016-public-product-catalogue.md)). An empty catalogue answers `{ "products": [] }`.

- **No pagination:** the whole catalogue is returned on purpose, for a shop-sized catalogue.
- **Cache:** `Cache-Control: public, max-age=30` on a success (the constant is
  `CATALOG_CACHE_CONTROL`; the value is a product decision to confirm). Every error answer carries
  `Cache-Control: no-store`.
- **Errors:** an unreachable database is the fixed `503` of "Database errors" below; anything else,
  including a corrupt row, is the generic `500` (no product name, id or column in the answer, and
  none in the logs).

## Resellers endpoint

`GET /api/v1/resellers` is public (no authentication, no query parameter, no body). It returns the
resellers that are visible (`active = true`; the database already guarantees their consent), as
`{ "resellers": [...] }`: the shape is `resellerListResponseSchema` of `@entana/contracts`. Each
reseller has exactly `id`, `name`, `neighborhood`, `landmark`, `latitude` and `longitude`. The
consent, the visibility and the verification date are never selected. A hidden reseller is absent,
and a deleted one no longer exists (see [ADR 0020](../../docs/adr/0020-resellers-are-deleted-for-good.md)).
The order is neighborhood, then name, then id. An empty list answers `{ "resellers": [] }`.

- **No pagination:** the whole list is returned on purpose, for a shop-sized list.
- **Cache:** `Cache-Control: public, max-age=30` on a success (the constant is
  `RESELLERS_CACHE_CONTROL`, the same value as the catalogue; the value is a product decision to
  confirm). Every error answer carries `Cache-Control: no-store`.
- **No rate limiting**, like the public catalogue.
- **Errors:** an unreachable database is the fixed `503` of "Database errors"; anything else is the
  generic `500`. OpenAPI tag `resellers`, operation `listResellers`.

## Delivery quote endpoint

`POST /api/v1/delivery/quote` is public (no authentication, no `Idempotency-Key`). The body,
`deliveryQuoteRequestSchema` of `@entana/contracts`, is strict: `{ latitude, longitude, pieces }`,
latitude from -90 to 90, longitude from -180 to 180, `pieces` an integer from 1 to 2970
(`MAX_ORDER_LINES` × `MAX_ORDER_LINE_QUANTITY`). The server reads the active axes with their active
places, and the settings (`shop_setting`), then applies `resolveDeliveryAxis` and
`computeDeliveryFee` of `@entana/contracts`, never rewritten here. The answer,
`deliveryQuoteResponseSchema`, is
`{ feeAr, reason, placeName, outOfAxisMessage, freeDeliveryMinPieces }`: `reason` is `axis`,
`quantity` or `out_of_axis`; `placeName` is set inside an axis only; `outOfAxisMessage` (from the
settings) only when `reason` is `out_of_axis`. The order creation computes the fee again: a quote
is only an announcement.

- **Privacy:** a POST, so that the coordinates stay out of URLs and access logs. They are neither
  logged nor stored.
- **Cache:** `Cache-Control: no-store`, the answer follows the settings of the moment.
- **No rate limiting:** no limit applies to the public routes as a whole, and the route has none of
  its own.
- **Errors:** `400` (invalid body, pointers and fixed texts only), `413`, `415`, the fixed `503` of
  "Database errors" and the generic `500`. OpenAPI tag `delivery`, operation `quoteDelivery`.

## Delivery zones endpoint

`GET /api/v1/delivery/zones` is public (no authentication, no query parameter, no body). It
returns the places a quote may match, so that the customer app draws one circle per place: the
active places that belong to at least one active axis, as `{ "zones": [...] }`. The shape is
`deliveryZoneListResponseSchema` of `@entana/contracts`. Each zone has exactly `id`, `name`,
`latitude`, `longitude` and `radiusM`; nothing of the axes (name, rank, colour) is returned. A place
of several active axes comes once. The order is name, then id. An empty list answers
`{ "zones": [] }`.

- **No pagination:** the whole list is returned on purpose, for a shop-sized list.
- **Cache:** `Cache-Control: public, max-age=30` on a success (the constant is
  `DELIVERY_ZONES_CACHE_CONTROL`, the same value as `RESELLERS_CACHE_CONTROL`). Every error answer
  carries `Cache-Control: no-store`.
- **No rate limiting**, like the resellers.
- **Errors:** an unreachable database is the fixed `503` of "Database errors"; anything else is the
  generic `500`. OpenAPI tag `delivery`, operation `listDeliveryZones`.

## Order endpoint

`POST /api/v1/orders` creates an order. Public, no account. Documented in the OpenAPI page
(`/api/docs`, development and test only).

**How to call it.** `Content-Type: application/json` (anything else is a 415) and an
`Idempotency-Key` header holding a uuid, sent **once** (upper or lower case, it is stored in lower case; a missing, malformed or repeated
header is a 400 that names only the header). The client generates both the idempotency key (once per order,
reused to retry) and the tracking token (32 random bytes in base64url, 43 characters): the API
stores only the hash of the token and never returns it. The body is the `createOrderRequestSchema`
of `@entana/contracts`; it is strict, so a price, a total, a fee or a status sent by the client is
a 400. The server prices the order from the database, and computes the delivery fee itself, in the
same transaction, with the rules of the quote below: from `location` and the sum of the quantities
of the lines. It freezes `delivery_fee`, `fee_reason` (`IN_AXIS`, `OUT_OF_AXIS` or `QUANTITY`),
`place_id` and `axis_id` (both null outside an axis, including a free delivery by quantity) on the
order; they are never computed again, whatever later happens to an axis, a place or a setting.

On success: `201` with `{ orderCode, status, totalAr, deliveryFeeAr, createdAt }` (`totalAr`
includes `deliveryFeeAr`) and `Cache-Control: no-store`. A replay (same key, same request) answers
the same `201` and the same body, with the frozen fee, with `Idempotent-Replayed: true`, and
writes nothing.

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
validation error carries a pointer and a fixed text chosen by the kind of failure (see "Errors"); an
unknown property is reported on its parent object (pointer `""`), and the `Idempotency-Key` header
on `/headers/idempotencyKey`. On every JSON route, a body that holds a `__proto__`, `constructor`
or `prototype` key at any depth, or that is more than 64 levels deep or has more than 100 000
values, is refused with a fixed 400 before validation (the validation pipe of Nest would otherwise
delete those keys silently and accept the rest).

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

## Order tracking

A customer who holds the tracking token of an order reads it and cancels it. Public, no account.
The token is the 43-character secret the client generated for the order (see "Order endpoint"). It
travels **only in the `X-Tracking-Token` header**: never in the path, never in the query string
(parameters are ignored), and the header is redacted wherever it would be logged. Both routes are
documented in the OpenAPI page, with the header declared as an API key.

| Route                          | Does                                                                  |
| ------------------------------ | --------------------------------------------------------------------- |
| `GET /api/v1/tracking`         | The order: status, delivery day, totals, whether it can be cancelled  |
| `POST /api/v1/tracking/cancel` | Cancels it while it is `NEW` or `CONFIRMED`. No body (one is ignored) |
| `POST /api/v1/tracking/lookup` | Finds an order again with the phone number and the order code         |

The body of the `200` is `trackingResponseSchema` of `@entana/contracts`, strict:
`orderCode`, `status`, `deliveryDate` (a day `YYYY-MM-DD` or `null`, the stored calendar date with
no time zone conversion), `landmarkText`, `totalAr`, `deliveryFeeAr`, `itemCount` (the sum of the quantities of the order's lines, a
positive integer), `createdAt`,
`rejectionReason` (the shop's reason, **only** for `REJECTED`, otherwise `null`) and `canCancel`
(computed by the server: true for `NEW` and `CONFIRMED`). It holds no name, phone number,
coordinates, internal identifier, administrator or internal note.

| Status | When                                                                                     | Body                                                  |
| ------ | ---------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| 200    | The order; for a cancel, the order after it (or already cancelled, with no second event) | The view above                                        |
| 404    | Token absent, malformed, unknown, or the order is past its retention                     | Fixed, the same for every reason: never a 400         |
| 409    | Cancel of an order that is `OUT_FOR_DELIVERY`, `DELIVERED`, `REJECTED` or `FAILED`       | Fixed. Nothing is changed                             |
| 429    | More than 120 requests per address in 10 minutes (both routes together)                  | The fixed body of the order limit, `Retry-After: 600` |
| 500    | Any unexpected error, among them an order with no line (never an `itemCount` of 0)       | Generic                                               |
| 503    | The database is unreachable                                                              | Fixed                                                 |

Every answer of these routes, errors included, carries `Cache-Control: no-store`,
`X-Robots-Tag: noindex` and `Referrer-Policy: no-referrer`. The token is validated with the shared
schema before the database is reached, and the order is found by the SHA-256 of the token (the
token is never compared in memory). The limit has its own counters, apart from the order creation
limit, and runs before the database and before any body is read (see `TRUST_PROXY` above).

**Lookup by phone number and order code.** For a customer who lost the token: `POST
/api/v1/tracking/lookup` with `{ "phone", "orderCode" }` (strict JSON, `application/json` only: a
415 otherwise). It is read only: the answer is the same view with `canCancel` always `false`, no
token is issued and none is returned. The phone number goes through `parsePhoneNumber` with the
`phoneCountryCode` of the instance: an invalid number is a 400 with a fixed detail that does not
repeat it. The order code may be typed in lowercase, with spaces or hyphens; it is normalised, then
checked with the order code schema. A code that cannot exist, an unknown code, another customer's
phone number and an order past its retention are **the same 404, with the same body**, found by
one statement (`public_code` and the customer's phone number): nothing tells which of the two did
not match. A blocked customer reads like any other. Neither value is logged (the access log holds
no body).

The order code is not a secret (32^6 values), so this route has two limits of its own, apart from
the tracking limit and from each other, both in memory and per instance:

| Limit                                  | Counts                                 | Answer                                                                           |
| -------------------------------------- | -------------------------------------- | -------------------------------------------------------------------------------- |
| 10 requests per address in 10 minutes  | every request, before the body is read | The fixed 429 body, `Retry-After: 600`                                           |
| 10 attempts per phone number in 1 hour | a valid number, before the database    | The same 429 body and `Retry-After: 600`, so the two limits cannot be told apart |

The first follows the rules of the other address limits (IPv4-mapped addresses count as IPv4, IPv6
per /64, at most 10 000 addresses tracked, see `TRUST_PROXY`). The second is keyed by the canonical
E.164 number, whatever the address, which is what stops many addresses from guessing the codes of
one customer; the number only lives in the memory of the limiter and is never logged. Each refusal
writes one fixed line (`tracking_lookup_address_limited`, `tracking_lookup_phone_limited`).

**Retention.** A finished order (`DELIVERED`, `REJECTED`, `CANCELLED`, `FAILED`) is answered like
an unknown token once its last status change is older than `TRACKING_RETENTION_DAYS` (30, to be
confirmed with the shop). The instant is the last `STATUS_CHANGED` event to the current status
(the order has no such column); an order without one falls back to its creation date.

**Cancellation.** One conditional `UPDATE ... WHERE id = ? AND status = <status read>` and the
`order_event` (from the old status to `CANCELLED`, actor `CUSTOMER`, empty payload) in one
transaction. A status changed by the shop in between matches no row: the order is read again, so a
decision of the shop is never overwritten, and ten simultaneous cancels write one event. The
reason stored is the fixed text "Annulée par le client." (the schema requires one); it is never
shown as a refusal.

**Deployment.** The tracking _page_ of the front end is a static HTML page served by the
production web server, not by this API. That server must add the same three headers to it
(`Cache-Control: no-store`, `X-Robots-Tag: noindex`, `Referrer-Policy: no-referrer`), because the
page URL holds nothing secret but the page and its requests are about one order.

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
