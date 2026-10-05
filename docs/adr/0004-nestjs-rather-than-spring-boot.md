# 0004. NestJS rather than Spring Boot

- Status: accepted
- Date: 2026-10-03

## Context

The system is made of an API and two TypeScript front ends (a customer PWA and an admin dashboard). They must share validation schemas and domain rules: status transitions, the delivery fee computation and the order total. The offline-sync logic (idempotent order creation, replay of queued actions) should also be written once, not once per side.

## Decision

Build the API with NestJS, in TypeScript. Validation schemas (Zod) and pure domain functions live in `packages/contracts` and are imported by the API and both front ends.

## Consequences

- One language end to end, and a single source of truth for the Zod contracts and the domain rules.
- NestJS has fewer built-in guardrails than Spring Boot. We compensate with strict TypeScript, lint rules, tests (domain logic as pure functions, database behaviour against a real PostgreSQL) and explicit module boundaries.
- The team must keep the framework out of the domain code, so that it stays pure and testable.

## Alternatives considered

- **Spring Boot:** mature, strongly typed, with excellent tooling. It was not chosen because it adds a second language and would duplicate the contracts and the domain rules between the API and the front ends.

See also [0010](0010-nestjs-12-esm-express-vitest-with-swc.md) (how NestJS 12 is set up) and [0011](0011-validation-with-standard-schema-and-shared-zod-contracts.md) (validation).
