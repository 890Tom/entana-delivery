# Architecture decision records

| Number                                                        | Title                                                                                           | Status   |
| ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | -------- |
| [0001](0001-record-architecture-decisions.md)                 | Record architecture decisions                                                                   | accepted |
| [0002](0002-use-pnpm-workspaces-and-turborepo.md)             | Use pnpm workspaces and Turborepo                                                               | accepted |
| [0003](0003-pin-typescript-6.md)                              | Pin TypeScript to 6.0 until typescript-eslint supports TypeScript 7                             | accepted |
| [0004](0004-nestjs-rather-than-spring-boot.md)                | NestJS rather than Spring Boot                                                                  | accepted |
| [0005](0005-dedicated-database-package.md)                    | A dedicated database package                                                                    | accepted |
| [0006](0006-prisma-7-and-postgresql-18.md)                    | Prisma 7 and PostgreSQL 18                                                                      | accepted |
| [0007](0007-check-constraints-in-a-hand-written-migration.md) | CHECK constraints in a hand-written migration, plain composite index instead of a partial index | accepted |

Planned records: PostGIS left out (setup in ADR 0006), delivery axes made of places, idempotent orders and offline mode, simplified order statuses, VPS hosting with OpenFreeMap tiles, hashed tracking token. Use [`0000-template.md`](0000-template.md).
