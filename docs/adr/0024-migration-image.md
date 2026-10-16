# 0024. Migration image

- Status: accepted
- Date: 2026-10-16

## Context

The API image (ADR 0012) holds the compiled API and its production dependencies only: no Prisma CLI and no migrations. A deployment still has to apply the migrations to its database before the API starts, from a machine that has Docker but not the sources or pnpm. The Prisma CLI is a development dependency of `@entana/database`; making it a production dependency would put it, and its large dependency tree, in the API image through `pnpm deploy --prod`.

## Decision

- **A separate, one-shot image** built by `packages/database/Dockerfile` (build context: the repository root). It runs `prisma migrate deploy` against the database named by `DATABASE_URL`, then exits with the code of that command. `migrate deploy` applies only pending migrations, so a second run on an up-to-date database exits with `0` and changes nothing.
- **Its own Dockerfile, not a target of the API Dockerfile.** The migrations belong to the database package (ADR 0005), and the API Dockerfile, its default target and the CI job that tests it stay unchanged.
- **Same build rules as ADR 0012:** multi-stage, the pinned `node:24.21.0-trixie-slim` base, pnpm from the pinned standalone image and not in the final image, files owned by `root`, the process run by the `node` user, exec form, the package managers of the base image removed, the strict `.dockerignore`.
- **Contents:** `package.json`, `prisma.config.ts`, `prisma/schema.prisma`, `prisma/migrations` and the `node_modules` of `pnpm deploy --dev` of the database package (the Prisma CLI and the other development tools of the package, without the runtime client).
- **Configuration from the environment only.** `DATABASE_URL` is passed to the run; no `.env` file is in the image (`prisma.config.ts` accepts its absence). `CHECKPOINT_DISABLE=1` stops the Prisma CLI from calling its update server.
- **No Compose service.** The image is run by hand (`docker run --rm`) before the API is started or updated.

## Consequences

- The API image keeps no migration tool, and the migrations can be applied with one `docker run`.
- The output of Prisma names the host, the port, the database and the user, never the password: checked for an unreachable server, an unknown host, a wrong password and a value that is not a URL.
- The image is large (about 800 MB on disk) because the Prisma CLI brings its studio, its local development server and their dependencies, and `--dev` also brings the test tools of the package. We accept it for an image that runs for seconds and is not exposed.
- The Node and pnpm versions now appear in two Dockerfiles, which must stay equal.

## Alternatives considered

- **A target in `apps/api/Dockerfile`:** shares the build stage, but a target placed after `runtime` becomes the default of `docker build`, and every change to the migration step would touch the file of the API image.
- **Migrations run by the API at start-up:** puts the Prisma CLI and the migrations in the API image and lets several replicas race on the schema.
- **The Prisma CLI as a production dependency:** `pnpm deploy --prod` of the API would then ship it.
- **Installing only `prisma` with `npm install` in the image:** bypasses the lockfile, so the version and its dependencies would no longer be pinned.
