# @entana/client

The customer application: React, Vite, TanStack Query, wouter for routing and MapLibre GL for the maps. The interface is in French. It is installable (a web app manifest, see [Installable app](#installable-app)) and has a service worker (see [Service worker](#service-worker)).

```sh
pnpm --filter @entana/client dev       # http://localhost:5173
pnpm --filter @entana/client build     # dist/
pnpm --filter @entana/client preview   # serves dist/
pnpm --filter @entana/client test
pnpm --filter @entana/client test:coverage
pnpm check:bundle                      # from the root, after a build: initial download under 300 KB gzip
```

## Screens

| Path               | Screen                                                                      |
| ------------------ | --------------------------------------------------------------------------- |
| `/`                | Catalogue                                                                   |
| `/panier`          | Cart                                                                        |
| `/livraison`       | Delivery point on a map, landmark, delivery fee quoted by the API           |
| `/coordonnees`     | Name and phone number                                                       |
| `/recapitulatif`   | Review, then the order is sent                                              |
| `/suivi`           | Tracking of an order; the link carries the token in the fragment (`#token`) |
| `/retrouver`       | Find an order again with the phone number and the order code                |
| `/ou-nous-trouver` | Resellers on a map and in a list                                            |

## Structure

- `src/features/<feature>/`: one folder per feature (catalogue, cart, delivery, contact, review, order-submission, tracking, find-order, resellers, active-order, instance…), each with its screen, its `api/` calls and its pure `rules/`.
- `src/components/`, `src/layout/`: shared interface primitives and the application shell.
- `src/i18n/`: the French texts.
- `src/routes.ts`: the fixed addresses of the screens.

## Installable app

- `public/manifest.webmanifest`: the static web app manifest (name, colours, icons). No orientation lock, no custom install button: the browser offers the installation.
- `public/icons-source/icon.svg`: the source of the icons. `public/icons/`: the generated PNG files (192, 512, 512 maskable, apple-touch-icon 180, favicon 32).
- Regenerate the icons from the root (sharp is a dependency of the API):

  ```sh
  pnpm --filter @entana/api exec node -e "const s=require('sharp'),i='../client/public/icons-source/icon.svg',o='../client/public/icons/';Promise.all([[192,'icon-192'],[512,'icon-512'],[180,'apple-touch-icon'],[32,'favicon-32']].map(([n,f])=>s(i,{density:300}).resize(n,n).png().toFile(o+f+'.png')).concat(s(i,{density:300}).resize(410,410).extend({top:51,bottom:51,left:51,right:51,background:'#1a1a1a'}).png().toFile(o+'icon-maskable-512.png')))"
  ```

- The icons, the name and the colours in the repository are generic. Before the build, a deployment replaces the icons with its own (same names, same sizes), and sets its `name` and `short_name` in the manifest and its `theme_color` and `background_color` in the manifest and in the `theme-color` meta tag of `index.html`. The maskable icon keeps its symbol in the central 80 % on a full background (the `background` of the command).

## Service worker

Generated at build time by vite-plugin-pwa from `config/pwa-config.ts`; off in development.

- **Interface precached**: the HTML, JavaScript, CSS, fonts and icons of the build. A navigation offline gets `index.html`, except under `/api` and `/media`.
- **Product photos cached first**: only `/media/products/<uuid>.webp` (a new name at every replacement), 60 files and 30 days at most, 200 answers only. Branding files are not cached.
- **API and map tiles never cached**: they always go to the network, so an order, a quote or a tracking view is never stale.
- **MapLibre excluded** from the precache (code and worker): it loads on demand on the two map screens.
- **Updates by notice**: a new version waits until the customer chooses « Mettre à jour », which activates it and reloads the page (the cart and the drafts are kept in the browser's storage). Never a reload on its own.

When the browser reports no network (`navigator.onLine` is false), a notice under the header says so. It offers no action and adds no offline mechanism: no order queue, no API cache.

The service worker controls every page of the client's origin: the admin must be on another origin, otherwise its pages would be intercepted. At deployment, serve `/sw.js` and `index.html` with `Cache-Control: no-cache`, so that a new version is found.

## Points of attention

- **API**: the browser calls its own origin. In development the Vite server forwards `/api` and `/media` to `http://127.0.0.1:3000`; in production the reverse proxy must do the same.
- **Device storage**: the cart, the drafts of the delivery and contact steps, the pending order (its idempotency key and tracking token, so that a retry after a network failure does not create a second order) and the confirmed orders are kept in the browser's storage.
- **Tracking token**: generated by the application, sent once at creation, then kept only in the tracking link and on the device. The API stores its hash only.
- **Theme**: a deployment's real design values go in `public/theme.local.css` (git-ignored). Without it, an empty stylesheet is served.
- **Deployment headers**: the tracking page must be served with `Cache-Control: no-store`, `X-Robots-Tag: noindex` and `Referrer-Policy: no-referrer` (see [the API README](../api/README.md#order-tracking)).
