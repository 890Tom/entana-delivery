# @entana/admin

The administration of the shop: sign in with the account made by `pnpm --filter @entana/api admin:upsert`, then reach the (provisional) home page. Everything except `/connexion` needs a session.

```sh
pnpm --filter @entana/admin dev      # http://localhost:5174 (port fixed)
pnpm --filter @entana/admin build
```

- **API**: the browser calls its own origin. In development the Vite server forwards `/api` and `/media` to `ADMIN_DEV_API_TARGET` (default `http://127.0.0.1:3000`). In production the same two paths are routed to the API by the reverse proxy. The API accepts the origin `http://localhost:5174` outside production by default (`ADMIN_ALLOWED_ORIGINS`).
- **Theme**: generic tokens are in `src/styles/tokens.css`. A deployment's real values go in `public/theme.local.css` (git-ignored, loaded at run time after the tokens), next to the one of the customer application.
- **Why a copy of some client components**: [ADR 0018](../../docs/adr/0018-separate-admin-application-with-minimal-copy-of-ui.md).
- **Development address**: open `http://localhost:5174`, not `127.0.0.1`: the API compares the `Origin` header with `ADMIN_ALLOWED_ORIGINS`, and another host name is refused (the screen then says the connection failed).
- **Deployment headers** (outside this application, set by the server that serves it): `Content-Security-Policy` with `frame-ancestors 'none'`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer` and `X-Robots-Tag: noindex`. A meta tag cannot set `frame-ancestors`, so without it the sign-in page can be framed.
