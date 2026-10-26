# 0026. Reverse proxy, security headers and caching

- Status: accepted; run-time mount and the `/maps/*` route added by [0030](0030-self-hosted-map-tiles.md)
- Date: 2026-10-16

## Context

The web image (ADR 0025) holds the built customer app and administration. A deployment needs one public entry point that terminates HTTPS, serves both front ends, forwards the API, and sets the headers that a static file server does not. The customer app has a service worker that precaches its interface (ADR 0023): a wrong cache rule, or HTML served in place of a missing script, breaks an installed app.

## Decision

**Caddy, configured by `deploy/web/Caddyfile` inside the web image.** No file is mounted at run time. Three environment variables are read when Caddy starts:

- `CLIENT_HOST` and `ADMIN_HOST` are the names of the two sites. No domain is written in the repository. If one is empty or unset, the configuration is refused.
- `API_UPSTREAM` is the address of the API, `api:3000` by default (the Compose service and the port the API image listens on).

HTTPS is automatic: certificates are obtained for the two names, HTTP redirects to HTTPS, and names under `.localhost` get certificates from Caddy's internal authority.

**Two origins.** The customer app and the administration are separate sites. A service worker controls every page of its origin, so on a shared origin the customer app's worker would intercept the administration. Separate origins also keep the session cookie of the administration away from the customer app.

**Routing on both sites:**

- `/api/*` and `/media/*` go to the API. The original `Host` header is kept, and `X-Forwarded-For` is added, so the API must run with `TRUST_PROXY=1`.
- Missing static files answer `404`. This covers `/assets/*`, `/fonts/*`, `/icons/*`, and any `.js`, `.css`, `.map` or `.webmanifest` file. They never get `index.html`: a stale build asking for an old chunk would otherwise get HTML with status 200, and the service worker would fail.
- Every other path is served from the files, compressed with zstd or gzip. A path with no file gets `index.html` (the single-page fallback). The administration has no special rule for `/suivi`: its fallback leads to its sign-in.
- Any other name is closed: a forged `Host` header, an unknown SNI or an unknown name over HTTP. A catch-all `:80` and `:443` site aborts the connection, so no file is served. The redirects to HTTPS of the two sites still apply.

**Security headers:**

| Header                      | Value                                                                                                                                                                                                                                                                                  | Where                                                        | Why                                                                                                                                                                                                                 |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Content-Security-Policy`   | `default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self' https://tiles.openfreemap.org; worker-src 'self' blob:; manifest-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'` | Pages and static files                                       | Only our own code runs. The OpenFreeMap tiles are the one outside origin. MapLibre uses `blob:` workers and images. No framing, no `<base>`, no plugins. Not set on `/api` and `/media`, where it protects nothing. |
| `Strict-Transport-Security` | `max-age=31536000`, without `includeSubDomains`                                                                                                                                                                                                                                        | Everywhere, replacing the API's value                        | Caddy is the public boundary and the only one that knows the site is HTTPS. Without `includeSubDomains`, other names of the shop's domain are not forced to HTTPS.                                                  |
| `X-Robots-Tag`              | `noindex, nofollow`                                                                                                                                                                                                                                                                    | Everywhere, replacing the API's value                        | No page of a shop, of the administration or of a tracking link is meant for search engines.                                                                                                                         |
| `Referrer-Policy`           | `no-referrer`                                                                                                                                                                                                                                                                          | Everywhere; on `/api` and `/media` only if the API sets none | A tracking address holds a token and must not leak to another site.                                                                                                                                                 |
| `X-Content-Type-Options`    | `nosniff`                                                                                                                                                                                                                                                                              | Everywhere; on `/api` and `/media` only if the API sets none | A file is never executed as another type.                                                                                                                                                                           |
| `Permissions-Policy`        | `geolocation=(self)` on the client, `geolocation=()` on the administration; on `/api` and `/media` only if the API sets none                                                                                                                                                           |                                                              | The customer app may locate the delivery address. The administration never needs it.                                                                                                                                |

Each "only if the API sets none" header is its own `header ?Name` directive. In a `header { }` block, Caddy gives every `?` field one shared condition, so a single field sent by the API would skip all of them.

**Caching.** Caddy sets no `Cache-Control` on `/api/*` and `/media/*`: the API's own values pass through untouched. On the static files:

| Path                                                                                     | `Cache-Control`                       | Why                                                                                |
| ---------------------------------------------------------------------------------------- | ------------------------------------- | ---------------------------------------------------------------------------------- |
| `index.html`, the fallback, `sw.js`, `theme.local.css` and anything without a rule below | `no-cache`                            | Revalidated on every load, so that a new version and its service worker are found. |
| `/assets/*`, `/workbox-*.js`                                                             | `public, max-age=31536000, immutable` | Their names hold a content hash and change with the content.                       |
| `/fonts/*`                                                                               | `public, max-age=604800`              | Same name across versions; rarely change.                                          |
| `/icons/*`                                                                               | `public, max-age=86400`               | Same name; a deployment may replace them (ADR 0025).                               |
| `/manifest.webmanifest`                                                                  | `public, max-age=3600`                | Same name; a deployment may change it.                                             |
| `/suivi*` (client only)                                                                  | `no-store`                            | The address holds a tracking token.                                                |
| A missing static file (`404`)                                                            | `no-store`                            | A missing file must not be cached as missing.                                      |

`no-cache` is the default, and the longer rules apply by path. Caddy evaluates `header` before the fallback rewrites the path to `/index.html`, so a default is safer than a list of pages.

## Consequences

- One image serves both front ends with their headers. A deployment sets only three variables.
- The cache and header rules are tested with a local container, not by an automated test. A change to the Caddyfile is checked with `caddy validate` and requests against a local container.
- The CSP still has to be confirmed in a browser, which is the next deployment step. `style-src 'self'` without `'unsafe-inline'` may block inline styles set by the interface or by MapLibre. If it does, the policy changes in a new decision.
- The API must run with `TRUST_PROXY=1` behind Caddy. Otherwise every customer shares the address of the proxy for rate limiting.
- The maps folder is mounted at run time, read-only, and `/maps/*` has its own rule: served without compression, and a missing file answers `404` with `no-store`, never `index.html` (ADR 0030).
- `/maps/*` serves the map files on the same origin as the pages, so the CSP does not change (ADR 0030).

## Alternatives considered

- **nginx:** no automatic HTTPS. Certificates and their renewal would be a separate tool and job.
- **One origin with the administration under a path:** the service worker of the customer app would control the administration's pages, and the cookie of the administration would be sent to the customer app.
- **Headers set by the API only:** the API does not serve the static files, and only the proxy sees every answer.
- **A Caddyfile mounted at run time:** one more file to keep in step with the image. The rules belong to the version of the front ends they serve.
