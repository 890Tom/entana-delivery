# entana-delivery

[![CI](https://github.com/890Tom/entana-delivery/actions/workflows/ci.yml/badge.svg)](https://github.com/890Tom/entana-delivery/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

**An open-source ordering and delivery app for small local businesses.** Customers order from their phone, the shop confirms and delivers, and everyone can follow the order, without a marketplace and without an account.

> **Status: early development.** The tooling is in place (TypeScript, ESLint, Prettier, Vitest, Turborepo, Git hooks, CI) along with the first shared package. The applications (database, API, customer PWA, admin dashboard) are added step by step, toward a first vertical slice: a customer orders, the admin confirms with a delivery date, the customer sees the confirmation. See the [roadmap](#roadmap).

## Why this project

It started from a real need: a family business in Madagascar taking orders through Facebook messages. The app replaces that with a structured flow designed for local constraints: unstable mobile networks, no precise postal addresses, cash on delivery.

## Key ideas

- **No customer account.** The phone number and a tracking link are enough; an order code lets a customer find their order again.
- **Delivery axes.** A delivery axis is an ordered list of places. Delivery is free along an axis, with a flat fee elsewhere. The fee is computed by a pure function shared by the API and both front ends.
- **Tolerant of bad networks.** Idempotent order creation, an offline-friendly PWA, no feature that requires the map to work.
- **Self-hosted and configurable.** One instance per business, configured by a file (name, logo, currency, language, map), with fake demo data to try it in minutes.
- **Admin dashboard.** Orders (confirm with a date, edit lines, refuse, move forward), catalogue with manual availability, resellers map, delivery axes.

## Tech stack

NestJS · Prisma · PostgreSQL · React + Vite (PWA) · MapLibre GL with OpenFreeMap tiles · Zod contracts shared across apps · pnpm + Turborepo · Docker Compose · GitHub Actions.

## Getting started

There is nothing to run yet: the applications are not in the repository. What you can do today is set up the development environment and run the checks.

### Prerequisites

- [Node.js](https://nodejs.org/) 24 (see `.nvmrc`)
- [pnpm](https://pnpm.io/) (the version is pinned in `package.json`)
- [Docker](https://www.docker.com/) (for the PostgreSQL database, from the database step on)
- [gitleaks](https://github.com/gitleaks/gitleaks) (the pre-commit hook scans staged changes and needs it installed locally)

### Install

```bash
git clone https://github.com/890Tom/entana-delivery.git
cd entana-delivery
pnpm install
```

Git hooks are installed automatically by `pnpm install` (through Husky). See [CONTRIBUTING.md](CONTRIBUTING.md) for what they check.

### Commands

| Command              | What it does                              |
| -------------------- | ----------------------------------------- |
| `pnpm typecheck`     | Type-check all packages                   |
| `pnpm lint`          | Lint with ESLint                          |
| `pnpm format`        | Format the repository with Prettier       |
| `pnpm format:check`  | Check formatting without changing files   |
| `pnpm test`          | Run the unit tests (Vitest)               |
| `pnpm test:coverage` | Run the unit tests with a coverage report |
| `pnpm db:up`         | Start PostgreSQL (Docker Compose)         |
| `pnpm db:down`       | Stop PostgreSQL (data is kept)            |
| `pnpm db:validate`   | Validate the Prisma schema                |

### Start the database

```bash
cp .env.example .env   # then set the same password in POSTGRES_PASSWORD and DATABASE_URL
pnpm db:up             # starts PostgreSQL 18 and waits until it is healthy
pnpm db:validate       # checks the Prisma schema
```

`DATABASE_URL` repeats the user, password, database and port of the `POSTGRES_*` variables, so change them together. A password with special characters must be URL-encoded in `DATABASE_URL` (a password of letters and digits avoids the problem).

PostgreSQL listens on `127.0.0.1:5433` only, not on the network (set `POSTGRES_PORT` to change the port). Data is stored in the `postgres_data` Docker volume and survives `pnpm db:down`. To erase it, run `docker compose down -v`.

The goal for the first vertical slice is a first test order in under 10 minutes with `docker compose up`. That setup is not available yet.

## Repository layout

```
packages/
  contracts/   shared Zod schemas and pure domain rules (first tests in place)
  database/    Prisma schema, migrations, client and seed (schema only for now)
docs/
  adr/         architecture decision records
  data-model.md  database schema reference
.github/       CI workflows, issue and pull request templates
.husky/        Git hooks
```

Planned, not yet created: `apps/` (API, customer PWA, admin dashboard), `examples/` (demo configuration and fake seed data), `infra/` (reverse proxy, backups).

## Documentation

- Architecture decision records: [`docs/adr`](docs/adr)
- Database schema: [`docs/data-model.md`](docs/data-model.md)
- Product specification (French): to be published in `docs/`

## Roadmap

| Milestone | Scope                                                           |
| --------- | --------------------------------------------------------------- |
| 1a        | Orders end to end: customer PWA, admin login, orders, catalogue |
| 1b        | Delivery axes with automatic fees, resellers map                |
| 2         | Driver app, dispatch by axis (not a priority yet)               |

## Contributing

Contributions are welcome once the first slice is in place. Read [CONTRIBUTING.md](CONTRIBUTING.md) and the [Code of Conduct](CODE_OF_CONDUCT.md) first. To report a vulnerability, see [SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE) © 2026 Tommy Zafitsiarendrika
