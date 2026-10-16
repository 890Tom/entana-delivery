# Deployment

Images and configuration for running a shop. The images are built from the repository root.

| Image   | Dockerfile                                                        | What it does                                                                                              |
| ------- | ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| API     | [`apps/api/Dockerfile`](../apps/api/Dockerfile)                   | The API (ADR 0012)                                                                                        |
| Migrate | [`packages/database/Dockerfile`](../packages/database/Dockerfile) | Applies the migrations, then exits (ADR 0024)                                                             |
| Web     | [`web/Dockerfile`](web/Dockerfile)                                | Caddy with the customer app, the administration and [`web/Caddyfile`](web/Caddyfile) (ADR 0025, ADR 0026) |

## Web image

```sh
docker build -f deploy/web/Dockerfile -t entana-web .
```

Without a build context named `overrides`, the image holds the demo application. A deployment's icons, manifest and themes are passed with `--build-context overrides=<folder>` (see the [customer app README](../apps/client/README.md#installable-app)). The production stack passes it from `OVERRIDES_DIR` (see [Branding](#branding-optional)).

Caddy reads three variables when it starts:

| Variable       | Default         | Meaning                                                  |
| -------------- | --------------- | -------------------------------------------------------- |
| `CLIENT_HOST`  | none (required) | Name of the customer site, for example `shop.example.mg` |
| `ADMIN_HOST`   | none (required) | Name of the administration site, on another origin       |
| `API_UPSTREAM` | `api:3000`      | Address of the API: the Compose service and its port     |

If `CLIENT_HOST` or `ADMIN_HOST` is empty, Caddy refuses its configuration. HTTPS is automatic. Both names must point to the server, with ports 80 and 443 open, so that Caddy can obtain certificates. Names under `.localhost` get certificates from Caddy's internal authority. Any other name, or a forged `Host` header, gets its connection closed.

Behind Caddy, run the API with **`TRUST_PROXY=1`**. Otherwise every customer shares the address of the proxy for rate limiting (see the [API README](../apps/api/README.md#configuration)). Set the API's `ADMIN_ALLOWED_ORIGINS` to `https://<ADMIN_HOST>` (the production stack below sets both).

The headers and cache rules are in ADR 0026. One point is still to confirm in a browser: the Content-Security-Policy has `style-src 'self'` without `'unsafe-inline'`, which may block inline styles set by the interface or by MapLibre.

Check a configuration without starting the server:

```sh
docker run --rm -e CLIENT_HOST=client.localhost -e ADMIN_HOST=admin.localhost \
  entana-web caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
```

## Production stack

`docker-compose.prod.yml` runs one shop on one server (ADR 0027). For a step-by-step setup on a new server, see [Test deployment on AWS Lightsail](lightsail.md). Prepare the environment once:

```sh
cp deploy/.env.example deploy/.env    # then fill in every value
chmod 600 deploy/.env                 # it holds the database password
```

Copy `examples/demo/instance.config.yaml` to the path set in `INSTANCE_CONFIG_FILE` (for example `/opt/entana/instance.config.yaml`) and adapt it to the shop. That file never goes into the repository. It must exist before the first `up`: the stack refuses to start without it and never creates it.

### Branding (optional)

Without `OVERRIDES_DIR`, the web image holds the demo icons, manifest and themes. To give the shop its own, create a folder on the server, for example `/opt/entana/overrides`, and set its absolute path in `deploy/.env`:

```text
/opt/entana/overrides/
├── client/public/icons/                  # icon-192.png, icon-512.png, icon-maskable-512.png, apple-touch-icon.png, favicon-32.png
├── client/public/manifest.webmanifest    # name, short_name, theme_color (hex), background_color
├── client/public/theme.local.css         # theme of the customer app
└── admin/public/theme.local.css          # theme of the administration
```

Every file is optional; each one replaces the file of the same name in the image. Any file outside `client/public/` and `admin/public/` fails the build. The folder holds the shop's brand: it never goes into the repository. The files are built into the image, so after any change to the folder, run the `up -d --build --wait` command again: installed apps then receive the new files through their usual update notice.

If `OVERRIDES_DIR` names a folder that does not exist, the build stops. When the path is outside the repository, the message reads `additional privileges requested: pass "--allow=fs.read=<parent folder>"`: create the folder or fix the path, never pass `--allow`.

Start or update the stack from the repository root:

```sh
docker compose --env-file deploy/.env -f deploy/docker-compose.prod.yml up -d --build --wait
```

| Service    | What it does                                                                                                           |
| ---------- | ---------------------------------------------------------------------------------------------------------------------- |
| `postgres` | PostgreSQL, on the `internal` network only. No port published.                                                         |
| `migrate`  | Applies pending migrations once the database is healthy, then exits. Not restarted.                                    |
| `api`      | Starts only after `migrate` succeeded. On `edge` and `internal`, no port published. Healthy when the database answers. |
| `caddy`    | The only service with published ports (TCP 80 and 443). Starts when the API is healthy.                                |

**Volumes.** `postgres_data` (the database), `media` (logo, icon, product photos), `caddy_data` (the certificates and the account of the certificate authority) and `caddy_config`. Back up `postgres_data` and `media` together. **Never delete `caddy_data`**: the certificates would be requested again, and the certificate authority limits how often. `docker compose down` keeps every volume; `down -v` deletes them all.

**Media volume.** `MEDIA_ROOT` stays `/media`, on the named volume `media`, never a folder of the host: a new named volume takes the owner of `/media` in the image (the `node` user that runs the API), a host folder does not. If the API cannot write its media (a volume created another way), give it back to that user:

```sh
docker compose --env-file deploy/.env -f deploy/docker-compose.prod.yml run --rm --no-deps --user root --entrypoint chown api -R node:node /media
```

**First admin.** No demo data is loaded (the seed refuses `NODE_ENV=production`). Create the first account in an interactive terminal; the password is typed twice, hidden:

```sh
docker compose --env-file deploy/.env -f deploy/docker-compose.prod.yml exec api node dist/cli/admin-upsert.js <email>
```

**After a code update.** `up -d --build` rebuilds the images and runs `migrate` again before the API restarts. To apply the migrations alone:

```sh
docker compose --env-file deploy/.env -f deploy/docker-compose.prod.yml run --rm migrate
```

It prints `No pending migrations to apply.` when the database is up to date.

**Logs.** Every service writes JSON files rotated at 10 MB, three files kept: `docker compose ... logs -f api`.
