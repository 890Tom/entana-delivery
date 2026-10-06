# syntax=docker/dockerfile:1
# Production image of the API. The build context is the repository root:
#   docker build -f apps/api/Dockerfile -t entana-api .

# Standalone pnpm binary (no Node inside). Keep the version equal to "packageManager" in the
# root package.json.
FROM ghcr.io/pnpm/pnpm:12.8.1 AS pnpm

# Debian slim, not Alpine: glibc is what the Node binary and native modules are tested with.
FROM node:24.21.0-trixie-slim AS build
COPY --from=pnpm /opt/pnpm /opt/pnpm
ENV PATH="/opt/pnpm:${PATH}"
WORKDIR /repo

# Manifests first: the dependency layer is rebuilt only when they change.
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json apps/api/
COPY packages/contracts/package.json packages/contracts/
COPY packages/database/package.json packages/database/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --store-dir /pnpm/store --filter "@entana/api..."

COPY tsconfig.base.json ./
COPY packages/contracts packages/contracts
COPY packages/database packages/database
COPY apps/api apps/api
# The database package compiles the generated Prisma client, so generation comes first. It needs
# no database connection (prisma.config.ts falls back to a placeholder URL).
RUN pnpm --filter @entana/database db:generate
# "..." builds the packages the API depends on (contracts, database) before the API itself.
RUN pnpm --filter "@entana/api..." build

# Self-contained folder: compiled API, production dependencies, and the built workspace packages.
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm --filter @entana/api --prod --store-dir /pnpm/store deploy /prod/api
# The deploy copies whole workspace packages. The database package keeps only what Node loads
# (package.json and dist, which holds the generated client): no sources, seed, tests or migrations.
RUN find /prod/api/node_modules/@entana/database/ -mindepth 1 -maxdepth 1 \
        ! -name package.json ! -name dist -exec rm -r {} +

FROM node:24.21.0-trixie-slim AS runtime
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000
WORKDIR /app
# package.json stays next to dist/: the API reads its name and version from it.
COPY --from=build --chown=root:root /prod/api/package.json ./package.json
COPY --from=build --chown=root:root /prod/api/dist ./dist
COPY --from=build --chown=root:root /prod/api/node_modules ./node_modules
USER node
EXPOSE 3000
# Node itself performs the check: the image has no curl.
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD ["node", "-e", "fetch(`http://127.0.0.1:${process.env.PORT}/api/v1/health`,{signal:AbortSignal.timeout(2000)}).then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"]
# Exec form without a package-manager wrapper: Node is PID 1 and receives SIGTERM directly.
ENTRYPOINT ["node", "dist/main.js"]
