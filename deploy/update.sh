#!/usr/bin/env bash
# Applies the version fetched with `git pull` (deploy/lightsail.md, section 11).
#
# Usage, on the server, from the repository root:
#   git pull
#   bash deploy/update.sh              # rebuilds migrate, api and caddy
#   bash deploy/update.sh caddy        # the front ends only (customer app, administration)
#   bash deploy/update.sh api caddy    # any of the three
#
# caddy holds both front ends, api the API, migrate the migrations. A change to packages/contracts
# reaches api and caddy. When unsure, give no argument.
set -euo pipefail

COMPOSE=(docker compose --env-file deploy/.env -f deploy/docker-compose.prod.yml)
ALL_SERVICES=(migrate api caddy)

step() { printf '\n==> %s\n' "$*"; }
fail() {
  printf 'ERROR: %s\n' "$*" >&2
  exit 1
}

# The compose paths are relative to the repository root, wherever the script is called from.
cd "$(dirname "${BASH_SOURCE[0]}")/.."

for arg in "$@"; do
  [[ " ${ALL_SERVICES[*]} " == *" $arg "* ]] || fail "unknown service: $arg (expected: ${ALL_SERVICES[*]})"
done
# The images to build, always in the order migrate, api, caddy.
if [[ $# -eq 0 ]]; then
  SERVICES=("${ALL_SERVICES[@]}")
else
  SERVICES=()
  for service in "${ALL_SERVICES[@]}"; do
    for arg in "$@"; do
      [[ "$arg" == "$service" ]] && SERVICES+=("$service")
    done
  done
fi

step "Checks"
[[ -f deploy/.env ]] || fail "deploy/.env is missing (deploy/lightsail.md, section 7)"
# Without --quiet, the printed configuration would show the database password.
"${COMPOSE[@]}" config --quiet || fail "invalid compose configuration"
if [[ -n "$(git status --porcelain --untracked-files=no)" ]]; then
  fail "tracked files are modified on the server: check git status before deploying"
fi
echo "Version to deploy: $(git log -1 --oneline)"
echo "Take a Lightsail snapshot first (section 12): migrations are not undone."

# One image at a time: two builds at once run a small instance out of memory.
for service in "${SERVICES[@]}"; do
  step "Building $service"
  "${COMPOSE[@]}" build "$service"
done

step "Restarting (migrate runs before the API)"
"${COMPOSE[@]}" up -d --wait

step "Services"
"${COMPOSE[@]}" ps -a

step "Migrations (expected: No pending migrations to apply.)"
"${COMPOSE[@]}" run --rm migrate

step "Removing the old untagged images"
docker image prune -f

step "Done: $(git log -1 --oneline)"
echo "Installed apps will show their update notice."
echo "To go back: git switch --detach <previous commit>, then run this script again."
