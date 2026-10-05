# 0009. Enforce the engineering standards with tooling

- Status: accepted
- Date: 2026-10-05

## Context

`docs/engineering-standards.md` was enforced by review only, apart from strict TypeScript and the default ESLint rules. Rules that depend on a reviewer's attention drift as the codebase grows, and several of them (dependency direction, naming, size limits) are cheap to check by machine.

## Decision

Every rule that a tool can check is an error in CI (job `quality`):

- ESLint (core rules and `@typescript-eslint/naming-convention`) for naming, size, complexity, `console`, default exports and the safety rules already in `strictTypeChecked`.
- `eslint-plugin-check-file` for kebab-case file names.
- `@eslint-community/eslint-plugin-eslint-comments` so that every `eslint-disable` carries a description, and `reportUnusedDisableDirectives` so that a stale one is an error.
- `dependency-cruiser` for the dependency direction and circular imports (`pnpm lint:architecture`).
- `knip` for unused files, exports and dependencies (`pnpm knip`).
- Vitest coverage thresholds per package, kept as floors (90%).

Existing code was refactored to satisfy the rules. The only exceptions are the ones written in the configuration: default exports in `*.config.*` files, `max-lines-per-function` in test files, and `@prisma/client` in knip until the package exports the generated client.

## Consequences

A change that breaks a rule cannot be merged. A new `apps/*` package is covered by the architecture rules without a configuration change, but a new kind of front-end file that needs a default export must be added to the exception in `eslint.config.mjs`. Four development dependencies are added. Linting is slightly slower (naming rules use type information).

## Alternatives considered

- `eslint-plugin-boundaries` for the architecture: reports in the editor, but needs its own element model, pulls six transitive dependencies and has no built-in circular dependency check. `dependency-cruiser` expresses all the rules in one file and also checks npm imports.
- A local ESLint rule for file names: no dependency, but code to maintain for a solved problem.
- Exempting the seed scripts from `no-console`: weaker than writing to `process.stdout` and `process.stderr`, which is what a command-line script does anyway.
