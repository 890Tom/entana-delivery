# 0007. CHECK constraints in a hand-written migration, plain composite index instead of a partial index

- Status: accepted
- Date: 2026-10-05

## Context

`docs/data-model.md` relies on CHECK constraints (phone format, amounts, status rules, a single settings row, and so on) and, for the order lists, on a partial index on `customer_order`. We checked what Prisma 7.10.0 (ADR 0006) offers for both.

- **CHECK constraints:** the Prisma schema has no syntax for them, and Prisma Migrate does not generate them (the database-features reference of Prisma 7 marks both as "not yet" outside MySQL 8+). Prisma does not report them as drift either: a `migrate dev --create-only` run without any schema change produced an empty migration after they were applied.
- **Partial indexes:** the `where` argument of `@@index` exists (since Prisma 7.4.0) but is still a Preview feature, behind `previewFeatures = ["partialIndexes"]`.
- **Customizing migrations:** `prisma migrate dev --create-only` creates an empty migration that is edited by hand, then applied by the next `prisma migrate dev`.

## Decision

- Write every CHECK constraint by hand in a dedicated migration, `add_check_constraints`, created with `--create-only`. Each constraint has an explicit name, `ck_<table>_<meaning>`, so a violation names the rule in the error message.
- Do not use the `partialIndexes` preview. Declare a plain composite index in the Prisma schema instead: `@@index([status, deliveryDate, axisId])` on `CustomerOrder`, named `customer_order_status_delivery_date_axis_id_idx`.
- Never edit a migration that has been applied or committed. A later change to a constraint is a new migration.
- A visible product requires a photo and its alternative text (`ck_product_photo_when_active`).

## Consequences

- The database rejects invalid data whatever the writer (API, seed, manual SQL).
- The constraints exist only in SQL. Prisma will not warn if someone drops one, so automated database tests against a real PostgreSQL cover them (`packages/database/src/check-constraints.integration.test.ts`, run by `pnpm test:integration`). A test fails when a constraint of the schema has no test case, or when a tested constraint is missing from the schema.
- The plain index also stores finished orders (`DELIVERED`, `REJECTED`, `CANCELLED`, `FAILED`), so it is larger than the partial index would be. For a single small business this is negligible, and the index leads with `status`, so queries on active statuses still use it.
- No preview feature in the schema, and nothing to migrate when Prisma changes it.

## Alternatives considered

- **Partial index with the `partialIndexes` preview:** smaller index, but it depends on a preview feature and its syntax may change.
- **Partial index in the hand-written migration:** works, but Prisma does not know about it and may try to drop it on the next `migrate dev`.
- **Validation in the application only:** does not protect against other writers, and the database is the last line of defence for rules such as the single settings row.
