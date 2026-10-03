# 0002. Use pnpm workspaces and Turborepo

- Status: accepted
- Date: 2026-10-03

## Context

The project has several deliverables that must share code: an API, a customer PWA and an admin dashboard. They share domain rules (order status transitions, delivery fee computation) and validation schemas, which must behave identically on both sides.

## Decision

A single repository (monorepo) managed with pnpm workspaces, with Turborepo to run tasks (build, typecheck, test) across packages with caching. Shared code lives in `packages/` (starting with `@entana/contracts`), applications in `apps/`.

The pnpm version is pinned with the `packageManager` field (Corepack). The newer `devEngines.packageManager` field is not used yet because tool support is uneven.

## Consequences

Shared rules are written once and tested once. A single install and a single set of tools. The cost is a little more configuration upfront and a workspace-aware way of running commands.

## Alternatives considered

- Separate repositories: shared code would need publishing and versioning, which is heavy for one developer.
- Nx: more powerful, but more concepts than this project needs.
- npm or Yarn workspaces: workable, but pnpm is faster and stricter about undeclared dependencies.
