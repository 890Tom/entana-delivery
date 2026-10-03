# 0003. Pin TypeScript to 6.0 until typescript-eslint supports TypeScript 7

- Status: accepted
- Date: 2026-10-03

## Context

TypeScript 7.0 (the native, Go-based compiler) is generally available since July 2026. It has no JavaScript compiler API. Tools that rely on that API, notably typescript-eslint, do not support it yet: typescript-eslint declares support for TypeScript below 6.1.0 and tracks support for 7.1 and later. We want type-aware linting.

## Decision

Pin TypeScript to the 6.0 line (`~6.0`). Dependabot ignores major and minor TypeScript updates. Revisit when typescript-eslint supports TypeScript 7.x.

## Consequences

Type-checking is slower than with TypeScript 7, which is acceptable for a codebase this size. We avoid a broken lint setup. We must remember to revisit the decision.

## Alternatives considered

- TypeScript 7 for `tsc` and a TypeScript 6 compatibility package for typescript-eslint: possible, but adds a fragile setup for little benefit now.
- Dropping type-aware lint rules: loses some of the most valuable checks (floating promises, unsafe `any`).
