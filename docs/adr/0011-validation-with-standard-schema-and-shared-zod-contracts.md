# 0011. Request validation through Standard Schema, with Zod schemas shared in contracts

- Status: accepted
- Date: 2026-10-05

## Context

The API and both front ends must validate the same data with the same rules (ADR 0004, `docs/engineering-standards.md` sections 6 and 7). NestJS usually validates with `class-validator` and `class-transformer`, which describe a shape with decorated classes: that cannot be shared with a front end, and it duplicates the TypeScript type. NestJS 12 added first-class support for libraries that implement [Standard Schema](https://standardschema.dev/): the `schema` option of `@Body`, `@Query` and `@Param`, and `StandardSchemaValidationPipe`. The installed Zod (4.6) implements Standard Schema, and `@nestjs/swagger` 12 reads Zod's JSON Schema output for the OpenAPI document.

## Decision

- Validate with **Zod schemas defined in `packages/contracts`**, and derive the TypeScript types from them with `z.infer`. A route declares its schema where the data enters: `@Body({ schema: createOrderSchema })`.
- Register **one global `StandardSchemaValidationPipe`**. Its `exceptionFactory` turns the issues into a `RequestValidationError`, which the single exception filter answers as `400` problem details (RFC 9457) with an `errors` list of `{ pointer, detail }`, where `pointer` is a JSON Pointer (RFC 6901) to the invalid field. Nest's default message format is never sent to a client.
- Response shapes are schemas of `contracts` too (`healthResponseSchema`, `problemDetailsSchema`), passed to the OpenAPI decorators with `standardSchema`, so the documentation cannot drift from the code.
- Environment variables are validated with Zod as well, at startup, by a pure function. These schemas stay in `apps/api`, because only the API reads the environment.
- **Not adopted:** `nestjs-zod`, `class-validator`, `class-transformer`, `@nestjs/config`. No dependency is added for validation beyond `zod` itself.

## Consequences

- One source of truth for the shape, the validation and the type, usable by the API and the front ends.
- Validation errors name the invalid fields in a stable, documented format.
- A route without `{ schema }` is not validated: reviewers and the end-to-end tests of each endpoint (success and every error case) must check it. There is no lint rule for this yet.
- Standard Schema validators can be asynchronous and can transform their input: the pipe passes the schema output to the handler (`transform: true`, the default), so handlers receive parsed values (for example coerced numbers).
- The `contracts` package depends on `zod` only, which `dependency-cruiser` already enforces.

## Alternatives considered

- **`nestjs-zod`:** adds a dependency and its own conventions to do what Nest 12 now does natively.
- **`class-validator` with DTO classes:** not shareable with the front ends, and a second description of each shape.
- **Valibot or ArkType:** also Standard Schema compatible, but Zod is already the choice of the repository (`CLAUDE.md`) and needs no converter for OpenAPI.
