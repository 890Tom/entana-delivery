# syntax=docker/dockerfile:1
# Static files of the customer app and of the administration, in a Caddy image (ADR 0025). The
# build context is the repository root:
#   docker build -f deploy/web/Dockerfile -t entana-web .
# A deployment applies its own icons, manifest and themes with a named build context:
#   docker build --build-context overrides=<folder> -f deploy/web/Dockerfile -t entana-web .
# Caddy reads CLIENT_HOST, ADMIN_HOST and API_UPSTREAM from the environment (ADR 0026).

# Deployment overrides: empty unless replaced with --build-context overrides=<folder>. The folder
# mirrors the applications: client/public/... and admin/public/... only.
FROM scratch AS overrides

# Standalone pnpm binary (no Node inside). Keep the version equal to "packageManager" in the
# root package.json.
FROM ghcr.io/pnpm/pnpm:12.8.1 AS pnpm

# Same pinned Debian slim base as the API and migrate images (ADR 0012, ADR 0024).
FROM node:24.21.0-trixie-slim AS build
COPY --from=pnpm /opt/pnpm /opt/pnpm
ENV PATH="/opt/pnpm:${PATH}"
WORKDIR /repo

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/client/package.json apps/client/
COPY apps/admin/package.json apps/admin/
COPY packages/contracts/package.json packages/contracts/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --store-dir /pnpm/store \
        --filter "@entana/client..." --filter "@entana/admin..."

COPY tsconfig.base.json ./
COPY packages/contracts packages/contracts
COPY apps/client apps/client
COPY apps/admin apps/admin

# Applied before the build, so that the service worker precaches the replaced files with their
# own revisions. Only the public folders can be replaced: an override never reaches the code.
COPY --from=overrides / /overrides/
RUN set -eu; \
    unexpected=$(cd /overrides && find . ! -type d ! -path './client/public/*' ! -path './admin/public/*'); \
    if [ -n "$unexpected" ]; then \
        echo "Overrides may only contain client/public/ and admin/public/. Unexpected:" >&2; \
        echo "$unexpected" >&2; \
        exit 1; \
    fi; \
    for app in client admin; do \
        if [ -d "/overrides/$app/public" ]; then cp -R "/overrides/$app/public/." "apps/$app/public/"; fi; \
    done

# The theme-color meta tag of index.html takes the theme_color of the final manifest, so that a
# deployment sets its colour once, in the manifest, and the repository keeps generic values.
RUN node --input-type=module <<'EOF'
import { readFileSync, writeFileSync } from "node:fs";

const manifest = JSON.parse(readFileSync("apps/client/public/manifest.webmanifest", "utf8"));
const color = manifest.theme_color;
if (typeof color !== "string" || !/^#(?:[0-9a-fA-F]{3}){1,2}$/.test(color)) {
  console.error("manifest.webmanifest: theme_color must be a hex colour such as #1a2b3c.");
  process.exit(1);
}
const metaTag = /<meta name="theme-color" content="[^"]*" \/>/;
const html = readFileSync("apps/client/index.html", "utf8");
if (!metaTag.test(html)) {
  console.error('index.html: no <meta name="theme-color"> tag to update.');
  process.exit(1);
}
writeFileSync(
  "apps/client/index.html",
  html.replace(metaTag, `<meta name="theme-color" content="${color}" />`),
);
EOF

# "..." builds contracts before the two applications.
RUN pnpm --filter "@entana/client..." --filter "@entana/admin..." build
# The icon source stays out of the precache (pwa-config.ts) and is never served.
RUN rm -rf apps/client/dist/icons-source

FROM caddy:2.11.7-alpine AS runtime
COPY --from=build --chown=root:root /repo/apps/client/dist /srv/client
COPY --from=build --chown=root:root /repo/apps/admin/dist /srv/admin
COPY --chown=root:root deploy/web/Caddyfile /etc/caddy/Caddyfile
