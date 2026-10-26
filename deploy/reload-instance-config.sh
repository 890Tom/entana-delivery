#!/usr/bin/env bash
# Applies a change to the shop file (INSTANCE_CONFIG_FILE in deploy/.env).
#
# Usage, on the server, from the repository root:
#   bash deploy/reload-instance-config.sh
#
# The API reads the shop file only when it starts, and deploy/update.sh does not restart it when
# its image is unchanged.
set -euo pipefail

COMPOSE=(docker compose --env-file deploy/.env -f deploy/docker-compose.prod.yml)

step() { printf '\n==> %s\n' "$*"; }
fail() {
  printf 'ERROR: %s\n' "$*" >&2
  exit 1
}

# The compose paths are relative to the repository root, wherever the script is called from.
cd "$(dirname "${BASH_SOURCE[0]}")/.."

step "Checks"
[[ -f deploy/.env ]] || fail "deploy/.env is missing (deploy/lightsail.md, section 7)"
# Without --quiet, the printed configuration would show the database password.
"${COMPOSE[@]}" config --quiet || fail "invalid compose configuration"

# Recreated rather than restarted: the container then mounts the file as it is now, even when an
# editor replaced it instead of writing into it.
step "Restarting the API"
"${COMPOSE[@]}" up -d --no-deps --force-recreate --wait api ||
  fail "the API did not become healthy: see ${COMPOSE[*]} logs --tail 50 api"

step "Services"
"${COMPOSE[@]}" ps api

step "Done"
echo "Browsers keep the shop description for up to one minute: reload the page after that."
