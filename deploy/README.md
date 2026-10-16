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

Without a build context named `overrides`, the image holds the demo application. A deployment's icons, manifest and themes are passed with `--build-context overrides=<folder>` (see the [customer app README](../apps/client/README.md#installable-app)).

Caddy reads three variables when it starts:

| Variable       | Default         | Meaning                                                  |
| -------------- | --------------- | -------------------------------------------------------- |
| `CLIENT_HOST`  | none (required) | Name of the customer site, for example `shop.example.mg` |
| `ADMIN_HOST`   | none (required) | Name of the administration site, on another origin       |
| `API_UPSTREAM` | `api:3000`      | Address of the API: the Compose service and its port     |

If `CLIENT_HOST` or `ADMIN_HOST` is empty, Caddy refuses its configuration. HTTPS is automatic. Both names must point to the server, with ports 80 and 443 open, so that Caddy can obtain certificates. Names under `.localhost` get certificates from Caddy's internal authority. Any other name, or a forged `Host` header, gets its connection closed.

Behind Caddy, run the API with **`TRUST_PROXY=1`**. Otherwise every customer shares the address of the proxy for rate limiting (see the [API README](../apps/api/README.md#configuration)). Set the API's `ADMIN_ALLOWED_ORIGINS` to `https://<ADMIN_HOST>`.

The headers and cache rules are in ADR 0026. One point is still to confirm in a browser: the Content-Security-Policy has `style-src 'self'` without `'unsafe-inline'`, which may block inline styles set by the interface or by MapLibre.

Check a configuration without starting the server:

```sh
docker run --rm -e CLIENT_HOST=client.localhost -e ADMIN_HOST=admin.localhost \
  entana-web caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
```
