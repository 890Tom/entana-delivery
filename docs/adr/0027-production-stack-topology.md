# 0027. Production stack topology

- Status: accepted
- Date: 2026-10-16

## Context

A shop runs on one server with Docker. The images exist: the API (ADR 0012), the migrations (ADR 0024) and the web image with Caddy (ADR 0025, ADR 0026). They need one file that starts them in the right order, exposes only what must be public, and keeps data across restarts. ADR 0013 left TLS to the database to be decided at deployment.

## Decision

- **One Compose file**, `deploy/docker-compose.prod.yml`, project name `entana`, with four services: `postgres`, `migrate`, `api` and `caddy`. The variables come from `deploy/.env` (git-ignored, `chmod 600`). Compose refuses to start without `POSTGRES_PASSWORD`, `CLIENT_HOST`, `ADMIN_HOST` or `INSTANCE_CONFIG_FILE`. `DATABASE_URL` is built from the PostgreSQL variables, so the password has one source.
- **Two networks.**
  - `edge` holds `caddy` and `api`.
  - `internal` is marked `internal: true` (no route outside) and holds `api`, `postgres` and `migrate`.

  The database is reachable from the API and the migrations only.

- **Only Caddy publishes ports**: TCP 80 and 443, with no UDP port, so no HTTP/3. The API and PostgreSQL publish none. Caddy runs with every capability dropped except `NET_BIND_SERVICE`.
- **Start order.**
  - `migrate` waits for a healthy database, applies pending migrations and exits (`restart: "no"`).
  - `api` starts only once `migrate` has completed successfully. Its health check is readiness (`/api/v1/health/ready`), run with Node, since the image has no curl.
  - `caddy` starts once the API is healthy.
- **API settings fixed in the file**: `NODE_ENV=production`, `TRUST_PROXY=1` (one proxy), `MEDIA_ROOT=/media`, `INSTANCE_CONFIG_PATH` (a file of the host mounted read-only), and an empty `CORS_ORIGINS`. `ADMIN_ALLOWED_ORIGINS` defaults to `https://<ADMIN_HOST>`.
- **Named volumes**:
  - `postgres_data`, mounted on `/var/lib/postgresql`, as the PostgreSQL 18 images expect;
  - `media`, a named volume, never a host folder, so that it takes the owner of `/media` in the image;
  - `caddy_data` (certificates), never deleted;
  - `caddy_config`.
- **Restart and logs.** Every service except `migrate` has `restart: unless-stopped`. Every service writes `json-file` logs rotated at 10 MB with three files, set once with a YAML anchor.
- **No TLS between the API and PostgreSQL.** The traffic never leaves the internal Docker network of the machine, and the database publishes no port. If the database ever moves to another machine, TLS becomes mandatory.

## Consequences

- One command starts or updates a shop, and every update runs the migrations before the new API starts.
- A failed migration leaves the API stopped rather than running on a schema it does not expect.
- Readiness as the health check means a database outage marks the API unhealthy. Docker Compose does not restart an unhealthy container, so the process keeps running. A database that is down at the first start keeps Caddy from starting.
- The database password must use only URL-safe characters, because Compose cannot percent-encode it.
- The `caddy` service also mounts a folder of the host (`MAPS_DIR`) read-only on `/srv/maps`, served under `/maps/` on both sites (ADR 0030).

## Alternatives considered

- **Publishing the API or the database on the host:** more ways in, and no need, since Caddy forwards `/api` and `/media`.
- **Migrations at API start-up:** see ADR 0024.
- **TLS to the database now:** certificates to create, mount and renew, protecting a link that never leaves the machine.
- **One network for every service:** Caddy could then reach PostgreSQL.
