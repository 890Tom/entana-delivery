# syntax=docker/dockerfile:1
# One-shot image that applies the Prisma migrations to the database named by DATABASE_URL, then
# exits with the code of `prisma migrate deploy`. The build context is the repository root:
#   docker build -f packages/database/Dockerfile -t entana-migrate .
# The API image stays free of the Prisma CLI and of the migrations (ADR 0024).

# Standalone pnpm binary (no Node inside). Keep the version equal to "packageManager" in the
# root package.json.
FROM ghcr.io/pnpm/pnpm:12.8.1 AS pnpm

# Same pinned Debian slim base as the API image (ADR 0012).
FROM node:24.21.0-trixie-slim AS build
COPY --from=pnpm /opt/pnpm /opt/pnpm
ENV PATH="/opt/pnpm:${PATH}"
WORKDIR /repo

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/database/package.json packages/database/
COPY packages/password-hash/package.json packages/password-hash/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --store-dir /pnpm/store --filter @entana/database

COPY packages/database/prisma.config.ts packages/database/
COPY packages/database/prisma packages/database/prisma
# The Prisma CLI is a devDependency of the database package: --dev installs it (and the other
# development tools of the package) without the runtime client, which migrations do not use.
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm --filter @entana/database --dev --store-dir /pnpm/store deploy /prod/migrate

FROM node:24.21.0-trixie-slim AS runtime
# No call to Prisma's update and telemetry server from a production run.
ENV CHECKPOINT_DISABLE=1
WORKDIR /app
COPY --from=build --chown=root:root /prod/migrate/package.json ./package.json
COPY --from=build --chown=root:root /prod/migrate/prisma.config.ts ./prisma.config.ts
COPY --from=build --chown=root:root /prod/migrate/prisma/schema.prisma ./prisma/schema.prisma
COPY --from=build --chown=root:root /prod/migrate/prisma/migrations ./prisma/migrations
COPY --from=build --chown=root:root /prod/migrate/node_modules ./node_modules
# Only node runs here: the package managers of the base image are removed, as in the API image.
RUN rm -rf \
        /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack \
        /usr/local/bin/yarn /usr/local/bin/yarnpkg \
        /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack \
        /opt/yarn-v1.22.22
USER node
# Exec form: the exit code of the migration is the exit code of the container. DATABASE_URL comes
# from the environment of the run; no .env file is in the image.
ENTRYPOINT ["node", "node_modules/prisma/build/index.js", "migrate", "deploy"]
