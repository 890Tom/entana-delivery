# 0010. NestJS 12 as an ESM application on Express, tested with Vitest and SWC

- Status: accepted
- Date: 2026-10-05

## Context

ADR 0004 chose NestJS. This record settles how `apps/api` is built with NestJS 12 (12.1 at the time of writing), whose core packages are ESM and whose new projects use Vitest. Four questions needed an answer: module format, HTTP adapter, how Nest's decorator metadata works under Vitest, and how a Node process can load the workspace package `@entana/contracts`, which exposes TypeScript source.

## Decision

- **ESM.** `apps/api` is `"type": "module"`, compiled by `tsc` with `module` and `moduleResolution` set to `NodeNext` (as the NestJS 12 migration guide recommends), with `.js` extensions in relative imports. Only what Nest needs is overridden from `tsconfig.base.json`, each override commented: `NodeNext`, `experimentalDecorators`, `emitDecoratorMetadata`, and the Node types.
- **Express adapter** (`@nestjs/platform-express`, Express 5). Its middleware ecosystem is the widest, and `nestjs-pino`, `helmet` and Swagger are tested on it. The speed advantage of Fastify does not matter at the scale of this application.
- **Build and development:** `tsc -p tsconfig.build.json` builds, `nest start --watch` (the NestJS CLI, as a development dependency only) runs in watch mode. The CLI is not used to build or to scaffold.
- **Tests with Vitest and SWC.** Vitest's own transformer does not emit decorator metadata, which Nest's dependency injection reads from constructor parameter types. As the NestJS documentation recommends, `unplugin-swc` and `@swc/core` compile the tests (`.swcrc`: legacy decorators and decorator metadata). `tsc` and the tests therefore behave the same way.
- **The tests boot the real application.** `createApplication` (also used by `main.ts`) and `configureApplication` are shared with the end-to-end tests, so that a wrong import (an injected class imported with `import type`, which neither TypeScript nor ESLint reports) fails a test instead of the first deployment.
- **`@entana/contracts` is built to JavaScript.** Its `exports` list two conditions: `types` points to `src/index.ts` and `default` to `dist/index.js`. TypeScript, ESLint, dependency-cruiser and knip use `types`, so they never read a build output and cannot see a stale one. Node (the API in production) and Vitest use `default`, so Turborepo builds `contracts` before `build`, `test`, `test:coverage`, `test:e2e` and `dev` (`^build`). The `typecheck` task has no such dependency.
- **One logger per process.** `nestjs-pino` keeps a single pino instance for the whole process, so the end-to-end tests of logging use one application per test file.
- **No `@nestjs/config`.** Configuration is a pure function (`parseConfig`) with a Zod schema, called once by `main.ts`. It is easier to test and adds no dependency (see ADR 0011 for the schemas).

## Consequences

- Front ends that use Vite can import `@entana/contracts` through the `types` condition for typing, but Vite resolves `default`, which is the compiled output: either Turborepo builds `contracts` first (`^build` on their `dev` and `build` tasks), or their Vite configuration adds a resolve condition that maps to the source. That choice is made when the first front end is added, not before.
- The API loads the compiled `contracts`, so a change to `contracts` needs a rebuild (`turbo dev` builds it once at start). Watching it as well can be added when `contracts` changes often.
- A class injected by Nest must be imported as a value. This is documented in `apps/api/README.md` and guarded by the end-to-end tests.
- The NestJS CLI adds about 60 packages to the lockfile, in development only. Dropping it for `tsc --watch` and `node --watch` is possible later.
- A `no-extraneous-class` exception (`allowWithDecorator`) is needed in ESLint for the empty `@Module()` classes, scoped to `apps/api`.
- Jest, Webpack, oxlint and the CLI's default scaffolding are not adopted. ESLint stays the only linter (ADR 0009).

## Alternatives considered

- **CommonJS:** NestJS 12 still supports it through `require(esm)`, but the rest of the repository is ESM and a second module system would be a permanent special case.
- **Fastify:** faster, but fewer integrations are tested with Nest 12, with no benefit here.
- **Explicit `@Inject()` on every provider** to avoid decorator metadata: it works with Vitest's own transformer, but it hides what the Nest documentation recommends and is easy to forget. The SWC setup is the documented one.
- **Bundling the API (esbuild, tsdown, SWC) to inline `contracts`:** one more tool and a build output that differs from the sources. Compiling `contracts` with `tsc` is the same tool as everything else.
- **Node's type stripping on the workspace sources:** not usable with `.js` import specifiers and with decorators, and still flagged as a warning on Node 24.
