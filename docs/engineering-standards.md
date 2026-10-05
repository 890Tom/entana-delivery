# Engineering standards

These rules keep the codebase consistent. Tooling enforces what it can (TypeScript strict mode, ESLint, dependency-cruiser, knip, coverage thresholds, CI); the rest is enforced by review. Each section ends with an **Enforced by** line that says which is which, and ADR 0009 records why. A rule is never switched off to make code pass: the code is fixed, and an exception is written in the configuration with its reason.

## 1. Principles

- Simple before clever. Build what the specification requires now, nothing speculative.
- One responsibility per module and per function. Prefer small pure functions.
- Explicit over implicit: types, names, errors.
- Every behaviour is tested. Tests are the executable specification.

## 2. TypeScript

- Strict mode. No `any` (use `unknown` and narrow). No non-null assertion (`!`) and no `as` cast, except right after validation at a boundary, with a comment.
- Explicit return types on exported functions. `import type` for type-only imports. No default exports unless a framework requires one.
- Derive types from the shared Zod schemas (`z.infer`): one source of truth for shape and validation.
- Model states with discriminated unions and check `switch` statements for exhaustiveness (`never`).
- Immutable by default (`const`, `readonly`); never mutate function arguments.
- No `console.log`: use the logger.

**Enforced by:** `strict` in `tsconfig.base.json`; ESLint `strictTypeChecked` (`no-explicit-any`, `no-non-null-assertion`, exhaustive checks); `consistent-type-imports`; `no-console`; a `no-restricted-syntax` rule against default exports (only `*.config.*` files are exempt, because tools read them); `@eslint-community/eslint-comments/require-description` (every `eslint-disable` explains why) and `reportUnusedDisableDirectives`. A command-line script writes to `process.stdout` and `process.stderr` instead of `console`. Review only: `as` casts, immutability, discriminated unions, deriving types from Zod.

## 3. Naming

- Files in kebab-case (`order-status.ts`), tests beside the file as `*.test.ts`. Classes in PascalCase, functions and variables in camelCase.
- Functions are verbs, booleans start with `is`, `has` or `can`. Domain words are in English and match the data model (order, axis, place, reseller).
- No abbreviations except `id`, `url` and the `Ar` (ariary) suffix already used in the data model.

**Enforced by:** `@typescript-eslint/naming-convention` (camelCase variables and functions, PascalCase types and classes, UPPER_SNAKE_CASE only for module-level `const`, `is`/`has`/`can` prefix on booleans) and `eslint-plugin-check-file` (kebab-case file names). Object and type keys are not checked, because they follow database columns and HTTP shapes. Review only: verbs for function names, abbreviations, domain words.

## 4. Structure and dependencies

- Dependency direction: `packages/contracts` (pure) is used by `packages/database`, `apps/api` and the front ends. Applications never import each other. `contracts` imports nothing from the repository and no framework or database library.
- The API is organised by domain module. A module exposes a service; other modules use only that public surface.
- API layers: controller (HTTP only: parse, call, respond), then service (use case, transaction), then data access (Prisma). Business rules are pure functions in `contracts`, called by services.
- Limits: files under about 300 lines, functions under about 40 lines, cyclomatic complexity of 10 or less, at most 4 parameters (otherwise pass an object).

**Enforced by:** `pnpm lint:architecture` (dependency-cruiser, `dependency-cruiser.config.mjs`): `contracts` imports nothing from the repository and only Zod from npm, packages never import an application, applications never import each other, only `apps/api` reaches the database package or a database library, no circular dependency, no unresolvable import. ESLint `complexity` (10), `max-lines-per-function` (40), `max-params` (4) and `max-lines` (300); blank lines and comments do not count, and test files are exempt from the function length only (a `describe` callback holds a whole file). `pnpm knip` reports unused files, exports and dependencies. Review only: the layers inside the API, and what a module exposes.

## 5. Domain rules

- Money is an integer number of ariary. Instants are stored in UTC; the delivery date is a day interpreted in the Indian/Antananarivo time zone. Domain code never calls `new Date()` directly: it receives a clock.
- Status changes go through the shared transition function. Each change writes an `order_event` in the same transaction.
- An order freezes the price, product name, delivery fee, axis and place at creation.
- Creation endpoints are idempotent.

**Enforced by:** review, and the tests of the shared transition and `quote` functions once they exist. No tool checks these yet.

## 6. Errors and validation

- Domain errors are typed classes thrown by services and mapped to problem details in one place. Never match on error messages, never swallow an error.
- Validate at the boundary with the shared Zod schemas; trust validated data inside.

**Enforced by:** ESLint (`no-floating-promises`, `only-throw-error`, `use-unknown-in-catch-callback-variable` from `strictTypeChecked`). Review only: typed domain errors, validation at the boundary.

## 7. API

- Routes live under `/api/v1`, with plural nouns and one error shape everywhere (RFC 9457 problem details). Response shapes are defined in `contracts`.
- Every endpoint is documented in OpenAPI and has end-to-end tests for success and for each error case.
- Authorisation is checked per route and per object.

**Enforced by:** review, and the end-to-end tests of each endpoint.

## 8. Database

- Schema changes only through migrations. A migration that has been applied or merged is never edited.
- CHECK constraints live in hand-written SQL migrations with explicit names. Rows are deactivated, not deleted.
- Select only the fields needed, use a transaction for multi-write operations, and avoid raw SQL outside migrations unless justified.

**Enforced by:** CI (`integration` job): migrations are applied to a real PostgreSQL, `prisma migrate diff` fails when `schema.prisma` and the migrations differ, and every CHECK constraint must have a test case. Review only: no edit of an applied migration, selecting only the needed fields.

## 9. Testing

- Test behaviour, not implementation: `it("refuses to confirm an order without a delivery date")`.
- Pyramid: many fast unit tests of pure domain code, integration tests on a real PostgreSQL, few end-to-end tests of critical journeys.
- Arrange, act, assert. One reason to fail per test. Deterministic and independent tests. Builders for test data.
- Do not mock the database or our own domain code; mock only external boundaries.
- A bug fix starts with a failing test. Coverage thresholds are a floor, not the goal.

**Enforced by:** `pnpm test:coverage` in CI: Vitest coverage thresholds per package, kept as floors (90% lines, functions, branches and statements for `contracts` and for `packages/database/src`). The thresholds only go up. Review only: test quality, the pyramid, a failing test before a bug fix.

## 10. Security and privacy

- No secret in code, logs or tests. No personal data in logs. Inputs are validated and queries are parameterised.
- Every new dependency is justified; prefer few.

**Enforced by:** the gitleaks hook and the `secrets-scan` CI job; `no-console` keeps data out of logs by accident. Review only: personal data in logs, justification of dependencies (knip reports the unused ones).

## 11. Git and review

- One branch per change, small pull requests, Conventional Commits, one logical change per commit. The pull request explains why.

**Enforced by:** git hooks (no commit or push on `main`, commitlint) and the `pr-title` CI job.

## 12. Definition of done

- Behaviour covered by tests written first. Typecheck, lint, format, architecture, dead-code and coverage checks pass (`pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm lint:architecture`, `pnpm knip`, `pnpm test:coverage`).
- Documentation and ADR updated when a decision was made.
- No commented-out code, no TODO without a reference.
- Migrations reviewed. Accessibility checked for user interface changes.
- Reviewed with the reviewer agents before the pull request.
