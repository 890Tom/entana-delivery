# entana-delivery

[![CI](https://github.com/890Tom/entana-delivery/actions/workflows/ci.yml/badge.svg)](https://github.com/890Tom/entana-delivery/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

**An open-source ordering and delivery app for small local businesses.** Customers order from their phone, the shop confirms and delivers, and everyone can follow the order, without a marketplace and without an account.

> **Status: early development.** The first vertical slice (a customer orders, the admin confirms with a delivery date, the customer sees the confirmation) is in progress. See the [roadmap](#roadmap).

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

*Coming with the first vertical slice.* The goal is a first test order in under 10 minutes:

```bash
git clone https://github.com/890Tom/entana-delivery.git
cd entana-delivery
cp .env.example .env
docker compose up
```

## Repository layout (planned)

```
apps/        api (NestJS), client (PWA), admin (dashboard)
packages/    contracts (Zod, quote, status transitions), ui, config
prisma/      schema and migrations
examples/    demo instance configuration and fake seed data
docs/        architecture, decision records (adr/), guides
infra/       Docker Compose, reverse proxy, backups
```

## Documentation

- Architecture decision records: [`docs/adr`](docs/adr)
- Product specification (French): to be published in `docs/`

## Roadmap

| Milestone | Scope |
|---|---|
| 1a | Orders end to end: customer PWA, admin login, orders, catalogue |
| 1b | Delivery axes with automatic fees, resellers map |
| 2 | Driver app, dispatch by axis (not a priority yet) |

## Contributing

Contributions are welcome once the first slice is in place. Read [CONTRIBUTING.md](CONTRIBUTING.md) and the [Code of Conduct](CODE_OF_CONDUCT.md) first. To report a vulnerability, see [SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE) © 2026 Tommy Zafitsiarendrika
