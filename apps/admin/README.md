# @entana/admin

The administration of the shop: React, Vite, TanStack Query, wouter, MapLibre GL and dnd-kit (drag and drop to reorder). The interface is in French. Sign in with an account made by `pnpm --filter @entana/api admin:upsert`; everything except `/connexion` needs a session.

```sh
pnpm --filter @entana/admin dev        # http://localhost:5174 (port fixed)
pnpm --filter @entana/admin build
pnpm --filter @entana/admin preview
pnpm --filter @entana/admin test
pnpm --filter @entana/admin test:coverage
```

## Screens

| Path                                                    | Screen                                                                                |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `/connexion`                                            | Sign-in                                                                               |
| `/`                                                     | Leads to the orders                                                                   |
| `/commandes`                                            | Orders: filters, search, counters, a banner for new orders (checked every 30 seconds) |
| `/commandes/:id`                                        | One order: lines, history, map, status changes, fee at confirmation                   |
| `/catalogue`, `/catalogue/nouveau`, `/catalogue/:id`    | Products: list and display order, form, photo, availability, retire and restore       |
| `/revendeurs`, `/revendeurs/nouveau`, `/revendeurs/:id` | Resellers: list and map, form, verification, deletion                                 |
| `/parametres`                                           | Delivery axes on a map, out-of-axis fee, free-delivery threshold                      |
| `/parametres/textes`                                    | The out-of-axis message                                                               |
| `/parametres/axes/nouveau`, `/parametres/axes/:id`      | One delivery axis and its places                                                      |

## Structure

- `src/features/<feature>/`: login, session (guard of the signed-in area), orders, order-detail, catalogue, resellers, settings, instance; each with its screens, its `api/` calls and its pure `rules/`.
- `src/components/`, `src/layout/`, `src/map/`, `src/order-display/`: shared interface parts.
- `src/i18n/`: the French texts. `src/routes.ts`: the addresses of the screens.
- Each screen has its own page title, declared in the route table `src/features/session/guard/signed-in-screens.ts`.

## Points of attention

- **API**: the browser calls its own origin. In development the Vite server forwards `/api` and `/media` to `ADMIN_DEV_API_TARGET` (default `http://127.0.0.1:3000`). In production the same two paths are routed to the API by the reverse proxy. The API accepts the origin `http://localhost:5174` outside production by default (`ADMIN_ALLOWED_ORIGINS`).
- **Development address**: open `http://localhost:5174`, not `127.0.0.1`: the API compares the `Origin` header with `ADMIN_ALLOWED_ORIGINS`, and another host name is refused (the screen then says the connection failed).
- **Theme**: generic tokens are in `src/styles/tokens.css`. The two brand colours of the instance are written as the same seven design roles when the instance arrives, with no local memory ([ADR 0029](../../docs/adr/0029-instance-theme-colors.md)). A deployment's other real values go in `public/theme.local.css` (git-ignored, loaded at run time after the tokens), next to the one of the customer application.
- **Why a copy of some client components**: [ADR 0018](../../docs/adr/0018-separate-admin-application-with-minimal-copy-of-ui.md).
- **Deployment headers** (outside this application, set by the server that serves it): `Content-Security-Policy` with `frame-ancestors 'none'`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer` and `X-Robots-Tag: noindex`. A meta tag cannot set `frame-ancestors`, so without it the sign-in page can be framed.
