# 0005. A dedicated database package

- Status: accepted
- Date: 2026-10-03

## Context

The API, the seed script and the integration tests all need the Prisma schema, the migrations and the generated client. The schema must have one owner, and the framework-free packages (`packages/contracts`) must not depend on a database.

## Decision

Create `packages/database` (`@entana/database`). It owns the Prisma schema, the migrations, the generated client and the seed script. The API imports the client from this package. `packages/contracts` stays free of any database code. The generated client is not committed: it is produced by `prisma generate`, which Turborepo runs before `typecheck`.

## Consequences

- One place to change the schema, and one place to look for database code.
- The API does not own database tooling, so it can stay focused on HTTP and use cases.
- An extra package to maintain, and a generation step before type-checking.

## Alternatives considered

- **Prisma inside the API application:** fewer packages, but the seed script and the integration tests would have to import from the API, and a second consumer of the client would be awkward.
- **A root `prisma/` folder:** simple, but it sits outside the workspace structure, with no package of its own for dependencies, scripts and Turborepo tasks.
