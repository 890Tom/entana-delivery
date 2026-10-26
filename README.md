# entana-delivery

An open-source ordering and delivery app for small local businesses. Customers order from their phone without an account; the shop confirms with a delivery day, delivers, and both follow the order. One instance per business, self-hosted, described by a configuration file.

It started from a family business in Madagascar that took orders through Facebook messages. The design follows local constraints: unstable mobile networks, no precise postal addresses, cash on delivery.

https://github.com/user-attachments/assets/797f482e-ee02-4d51-80d7-f698c0abaae6

## Project status

Early development. Nothing is deployed yet.

Deploying one shop to one server is documented step by step in [deploy/lightsail.md](deploy/lightsail.md) (AWS Lightsail, for a test). Automatic backups are not in place yet.

**Done**

- Customer application (`apps/client`), in the browser:
  - catalogue with manual availability, and a cart kept on the device;
  - delivery step: a point chosen on a map (MapLibre GL), the delivery zones drawn on it, a written landmark, and the delivery fee announced by the server;
  - contact details (name, and a phone number checked with the numbering rule of the instance's country), review, then an idempotent order creation;
  - tracking of an order through its link (the token stays in the URL fragment), with cancellation while the order is `NEW` or `CONFIRMED`;
  - finding an order again with the phone number and the 6-character order code;
  - a map and a list of the shop's resellers;
  - installable: a web app manifest and icons;
  - a service worker: the interface precached (without MapLibre), product photos cached, neither the API nor the map tiles cached;
  - a notice when a new version is available, which applies the update on a click, and a notice when the network is missing.
- Administration (`apps/admin`):
  - sign-in with an e-mail and a password (session cookie);
  - orders: list with filters, search and counters, new orders shown every 30 seconds, an order's detail with its history, one-step status changes (confirm with a delivery day and an optional adjusted fee, refuse, cancel, out for delivery, delivered, failed);
  - catalogue: create, edit, photo upload, availability, retire and restore, display order;
  - resellers: create, edit, verify, delete, on a map;
  - settings: delivery axes and their places on a map, the out-of-axis fee, the free-delivery threshold and the out-of-axis message;
  - a page title for each screen.
- API (`apps/api`): the routes behind both applications, listed in [`apps/api/README.md`](apps/api/README.md#routes), with health and readiness probes and an OpenAPI page.
- Database schema, migrations and fake seed data (`packages/database`).

**Planned**

- Editing the lines of an order from the administration (the `LINES_EDITED` event type exists in the schema, no route writes it).
- Production deployment: HTTPS, HTTP headers, a reverse proxy, backups, a one-command demo setup.
- A test of the customer application on a real Android device.
- Replacing the generic icons with those of a real deployment (the two brand colours are set in the instance file).
- A driver application with dispatch by axis (the `DRIVER` role and the `driver_id` and `tour_position` columns are reserved for it).

## Known limits and what comes next

- No deployment before the production step: the repository runs locally only.
- Not yet tested on a real Android device.
- Accessibility has only been checked with automated audits; no manual screen-reader testing yet.
- Orders are paid in cash on delivery only: no online payment and no payment tracking.
- No stock management: availability is set by hand.
- One business per instance: no multi-tenant hosting.

## Repository layout

```
apps/
  api/          NestJS API (REST under /api/v1)
  client/       customer application (React + Vite)
  admin/        administration (React + Vite)
packages/
  contracts/      shared Zod schemas and pure domain rules
  database/       Prisma schema, migrations, client factory and seed
  password-hash/  Argon2id password hashing
  lint-tests/     tests of the ESLint configuration
examples/demo/  demo instance configuration
docs/
  adr/            architecture decision records
  data-model.md   database schema reference
  engineering-standards.md
scripts/        bundle size check
```

Dependency direction: `contracts` is used by everything and imports nothing from the repository; only `apps/api` uses `database` and `password-hash`; applications never import each other (`pnpm lint:architecture`).

Stack: Node 24, TypeScript 6.0, NestJS 12, Prisma 7, PostgreSQL 18, React, Vite, TanStack Query, MapLibre GL with OpenFreeMap tiles, pnpm workspaces, Turborepo, Docker Compose.

## Prerequisites

- [Node.js](https://nodejs.org/) 24.7 or later (`.nvmrc`, `engines` in `package.json`)
- [pnpm](https://pnpm.io/), at the version pinned in `packageManager` of `package.json`
- [Docker](https://www.docker.com/), for PostgreSQL
- [gitleaks](https://github.com/gitleaks/gitleaks), used by the pre-commit hook

## Run it locally

```bash
git clone https://github.com/890Tom/entana-delivery.git
cd entana-delivery
pnpm install                 # also installs the Git hooks (Husky)
cp .env.example .env         # then choose a database password (see below)
pnpm db:up                   # PostgreSQL 18 on 127.0.0.1:5433, waits until healthy
pnpm --filter @entana/database exec prisma migrate deploy
pnpm build
pnpm db:seed                 # fake demo data; prints a random password once
pnpm --filter @entana/api admin:upsert you@example.com --name "You"
pnpm dev                     # API, customer application and administration in watch mode
```

- Set the same password in `POSTGRES_PASSWORD` and `DATABASE_URL`. `DATABASE_URL` repeats the user, password, database and port of the `POSTGRES_*` variables; percent-encode special characters of the password in it.
- The seeded admin account has no e-mail, so it cannot sign in: `admin:upsert` creates an account that can (it asks for the password twice on the terminal).
- Addresses in development: the API on `http://127.0.0.1:3000` (OpenAPI page at `/api/docs`), the customer application on `http://localhost:5173`, the administration on `http://localhost:5174` (use `localhost`, not `127.0.0.1`). Both front ends forward `/api` and `/media` to the API.
- Data lives in the `postgres_data` Docker volume and survives `pnpm db:down`; `docker compose down -v` erases it.
- Product photos and the shop logo are read from `./media` at the repository root in development (git-ignored).

The API can also run as a container: see [`apps/api/README.md`](apps/api/README.md#container).

## Scripts

Run from the repository root.

| Command                  | What it does                                                                  |
| ------------------------ | ----------------------------------------------------------------------------- |
| `pnpm dev`               | Starts the API, the customer application and the administration (watch)       |
| `pnpm build`             | Builds every package and application                                          |
| `pnpm typecheck`         | Type-checks every package                                                     |
| `pnpm lint`              | Generates the Prisma client, then runs ESLint                                 |
| `pnpm format`            | Formats the repository with Prettier                                          |
| `pnpm format:check`      | Checks formatting without changing files                                      |
| `pnpm lint:architecture` | Checks dependency direction and circular imports (dependency-cruiser)         |
| `pnpm knip`              | Reports unused files, exports and dependencies                                |
| `pnpm test`              | Unit and end-to-end tests (Vitest). No database needed                        |
| `pnpm test:e2e`          | The API end-to-end tests alone                                                |
| `pnpm test:coverage`     | Tests with the coverage floors (the API floor is applied by the next one)     |
| `pnpm test:coverage:api` | API unit and integration coverage merged, with its 90% floor. Needs database  |
| `pnpm test:integration`  | Tests against a real PostgreSQL (throwaway database). Needs `pnpm db:up`      |
| `pnpm test:scripts`      | Tests of the scripts in `scripts/`                                            |
| `pnpm check:bundle`      | Checks the initial download of the built customer application (300 KB gzip)   |
| `pnpm db:up`             | Starts PostgreSQL (Docker Compose)                                            |
| `pnpm db:down`           | Stops PostgreSQL (data is kept)                                               |
| `pnpm db:generate`       | Generates the Prisma client                                                   |
| `pnpm db:validate`       | Validates the Prisma schema                                                   |
| `pnpm db:seed`           | Fills an empty local database with fake data                                  |
| `pnpm db:reset-and-seed` | Erases a local database and seeds it again (guarded, see the database README) |

Before a commit: `pnpm typecheck`, `pnpm lint`, `pnpm format:check`.

## Environment variables

Copy [`.env.example`](.env.example) to `.env` at the repository root. `.env` is never committed.

| Variable                 | Read by                     | Purpose                                                |
| ------------------------ | --------------------------- | ------------------------------------------------------ |
| `NODE_ENV`               | API, seed                   | `development`, `test` or `production` (API default)    |
| `HOST`, `PORT`           | API                         | Listening interface and port                           |
| `LOG_LEVEL`              | API                         | pino log level                                         |
| `TRUST_PROXY`            | API                         | Number of reverse proxies in front of the API          |
| `BODY_LIMIT_KB`          | API                         | Largest JSON request body                              |
| `SWAGGER_ENABLED`        | API                         | Serves `/api/docs`                                     |
| `CORS_ORIGINS`           | API                         | Browser origins allowed to call the API                |
| `ADMIN_ALLOWED_ORIGINS`  | API                         | Origins allowed to change data under `/api/v1/admin`   |
| `ADMIN_COOKIE_SECURE`    | API                         | `Secure` flag of the session cookie                    |
| `INSTANCE_CONFIG_PATH`   | API                         | Instance configuration file                            |
| `MEDIA_ROOT`             | API                         | Media folder (logo, product photos)                    |
| `DATABASE_URL`           | API, database package, seed | PostgreSQL connection URL                              |
| `POSTGRES_*`             | Docker Compose              | User, password, database and host port of PostgreSQL   |
| `INSTANCE_CONFIG_FILE`   | Docker Compose              | Instance file mounted in the `api` container           |
| `API_PORT`               | Docker Compose              | Host port of the `api` container                       |
| `INITIAL_ADMIN_USERNAME` | Seed                        | Username of the seeded admin account (default `admin`) |
| `ADMIN_DEV_API_TARGET`   | Administration (Vite)       | Where the dev server forwards `/api` and `/media`      |

Details and defaults: [`apps/api/README.md`](apps/api/README.md#configuration) and [`packages/database/README.md`](packages/database/README.md).

## Documentation

- API: [`apps/api/README.md`](apps/api/README.md)
- Customer application: [`apps/client/README.md`](apps/client/README.md)
- Administration: [`apps/admin/README.md`](apps/admin/README.md)
- Packages: [`contracts`](packages/contracts/README.md), [`database`](packages/database/README.md), [`password-hash`](packages/password-hash/README.md), [`lint-tests`](packages/lint-tests/README.md)
- Database schema: [`docs/data-model.md`](docs/data-model.md)
- Architecture decision records: [`docs/adr`](docs/adr/README.md)
- Engineering standards: [`docs/engineering-standards.md`](docs/engineering-standards.md)
- Contributing: [`CONTRIBUTING.md`](CONTRIBUTING.md), [Code of Conduct](CODE_OF_CONDUCT.md), security: [`SECURITY.md`](SECURITY.md)

## License

[MIT](LICENSE) © 2026 Tommy Zafitsiarendrika
