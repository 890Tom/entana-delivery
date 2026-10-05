# 0012. Container image for the API

- Status: accepted
- Date: 2026-10-05

## Context

The application is self-hosted: a business runs one instance, so the API has to be delivered as something that runs the same way on any machine with Docker. Delivery is not development. Developers run the API from the sources with `pnpm dev`, with the database in Docker Compose (ADR 0010 describes the build). The image only has to run the compiled API.

The build context is the repository root, and it contains local files that are not versioned (environment files, keys, assistant files, dependencies, build outputs). Without care, a `COPY` could put them in an image that is then shared.

## Decision

- **Multi-stage build** (`apps/api/Dockerfile`). A `build` stage installs the dependencies, compiles `contracts` and the API, and uses `pnpm deploy --prod` to produce a self-contained folder. The `runtime` stage copies only `package.json`, `dist` and `node_modules` from it. pnpm comes from a pinned standalone image and is not in the final image.
- **Pinned Debian slim Node image** (`node:24.21.0-trixie-slim`) for both stages, not Alpine: glibc is what the Node binary and native modules are tested with.
- **Production dependencies only** in the final image (`pnpm deploy --prod`).
- **Non-root.** The process runs as the `node` user. The application files are owned by `root`.
- **Defaults set by the image:** `NODE_ENV=production`, `HOST=0.0.0.0`, `PORT=3000`. `HOST` must be `0.0.0.0` in a container; `127.0.0.1` makes the API unreachable through the published port.
- **Health check written with Node.** It requests `/api/v1/health` with `fetch`. The image has no `curl`, and none is added.
- **Start with `node dist/main.js`** in exec form, without a package-manager wrapper: Node is PID 1 and receives `SIGTERM` directly.
- **Strict `.dockerignore`** at the repository root: version control, assistant files, environment files (except `.env.example`), keys, dependencies, build outputs, logs and runtime data stay out of the build context.
- **Compose profile `app`.** The `api` service is in `docker-compose.yml` behind the profile `app`, so `docker compose up` starts only the database. `NODE_ENV`, `HOST` and `PORT` are literal values there, so that a variable exported in the shell or set in `.env` cannot override them.
- **A `docker` CI job** builds the image, starts it with `docker run -p 3000:3000` and tests it from the host through the published port: the health response (status 200, `Cache-Control: no-store`, `"status":"ok"` in the body), a non-zero user id, the `healthy` state reported by Docker, and a graceful stop (exit code 0 in under 10 seconds). The image's own health check runs inside the container and cannot see a wrong `HOST`; only a test from outside can.

## Consequences

- One command builds an image that runs the API with production settings, and the same image is tested in CI.
- We accept a Debian slim base rather than Alpine, for the glibc runtime.
- The pnpm version appears in `package.json` and in the Dockerfile, which must stay equal (the Dockerfile says so). The Node version is pinned separately in the Dockerfile.
- Every file the image needs must be copied explicitly in the Dockerfile, and the `.dockerignore` excludes by default, so a new local file cannot enter the image by accident. A change to the layout of the packages means a change to the Dockerfile.
- The image contains no database client or migration step yet, since the API does not use the database yet.
- The `docker` job adds a build and a start to every pull request run (timeout: 15 minutes).

## Alternatives considered

- **Alpine image:** smaller, but it uses musl rather than glibc, which is not what the Node binary and native modules are tested with.
- **Bundling the API into one file** (see also ADR 0010): one more tool and a build output that differs from the sources. `pnpm deploy --prod` already gives a small, self-contained folder.
- **Running as root:** not chosen; the process runs as the `node` user.
- **Development inside containers:** not chosen. Development stays on the host with `pnpm dev`; only the database runs in Docker Compose by default.
