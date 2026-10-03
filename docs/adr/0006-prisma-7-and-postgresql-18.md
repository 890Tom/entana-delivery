# 0006. Prisma 7 and PostgreSQL 18

- Status: accepted
- Date: 2026-10-03

## Context

Prisma 7 changed how a project is set up compared with earlier majors. The `prisma` package's `latest` npm tag currently points to a release candidate of Prisma 8 (`8.0.0-rc.19`), while `@prisma/client` and `@prisma/adapter-pg` are on 7.10.0 stable.

## Decision

- Pin Prisma to the stable **7.10.0** (exact version, `prisma` and `@prisma/client`). Move to Prisma 8 when it is released as stable.
- Configuration lives in `packages/database/prisma.config.ts` (schema path, migrations path, datasource URL). The `datasource` block of the schema has no URL.
- Use the `prisma-client` generator with an explicit output in `src/generated` (not committed). The client is created with a driver adapter: `@prisma/adapter-pg` with `pg`, added in the step that first instantiates the client.
- `.env` files are not read by Prisma 7. `prisma.config.ts` loads the root `.env` with `process.loadEnvFile`, and does not need `dotenv`. When `DATABASE_URL` is unset, a placeholder lets `prisma validate` and `prisma generate` run (in CI, for instance).
- Allow the install scripts of `prisma` and `@prisma/engines` in `pnpm-workspace.yaml` (`allowBuilds`), because pnpm blocks them by default and `pnpm install` fails otherwise.
- Use PostgreSQL **18** (`postgres:18-alpine`) in Docker Compose, without PostGIS. The volume is mounted at `/var/lib/postgresql`, the location expected by the PostgreSQL 18 image.

## Consequences

- No release-candidate software in the dependency tree.
- Setup differs from older Prisma tutorials: configuration file, generator, adapter and environment loading must all be explicit.
- Prisma 8 will be a deliberate migration, not an accidental upgrade.

## Alternatives considered

- **Prisma 8 release candidate:** newer, but not stable, and it is what a plain `pnpm add prisma` would install today.
- **Prisma 6:** a familiar setup, but the previous major, with an older generator and configuration model.
- **`dotenv`:** one more dependency for something Node does natively.
