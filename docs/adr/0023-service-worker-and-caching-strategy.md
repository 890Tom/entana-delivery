# 0023. Service worker and caching strategy

- Status: accepted
- Date: 2026-10-15

## Context

Customers order from their phone, often on unstable mobile networks. The customer application
should open quickly and stay usable when the network drops, and it should be installable. At the
same time, a quote, a tracking view or an order must never be shown out of date: the delivery fee
is computed by the server, and an order is only valid once the server has accepted it. The map
library is large and is used by two screens only. The administration is a separate application
(ADR 0018), used at a desk.

## Decision

- The service worker of the customer application is generated at build time by vite-plugin-pwa in
  `generateSW` mode (`apps/client/config/pwa-config.ts`), and is off in development. A new version
  waits until the customer chooses « Mettre à jour » in a notice (`registerType: "prompt"`); it is
  never activated with an automatic reload.
- The interface is precached: the HTML, JavaScript, CSS, fonts, icons and manifest of the build.
  MapLibre (`maplibre-gl*`), the `.map` files and `icons-source/` are excluded from the precache.
- Product photos of the client's own origin, `/media/products/<uuid>.webp` with a lower-case UUID,
  are served cache first, 60 entries and 30 days at most, and only answers with status 200 are
  stored. The API gives a photo a new name at every replacement. A branding file is replaced
  under the same name, so it is never cached first.
- The service worker never caches the API: a quote, a tracking view or an order must not be stale.
  Map tiles are not cached either.
- Offline, the interface opens (a navigation gets `index.html`, except under `/api` and `/media`),
  a notice under the header says that the network is missing, and placing an order requires the
  network. There is no order queue and no background synchronisation.
- The administration is not a PWA.
- The icons in the repository are generic. A deployment replaces them before the build (same names,
  same sizes), and sets `name` and `short_name`, `theme_color` and `background_color` in the
  manifest. The service worker controls the whole origin of the client, so the administration must
  be served from another origin.

## Consequences

- A returning customer gets the interface without downloading it again, and sees product photos
  already viewed even with a weak network.
- The quote, the tracking and the orders always come from the server: without a network these
  screens show an error rather than old data.
- The map screens need the network: the service worker stores neither MapLibre nor the tiles.
- An update reaches a customer only when they choose it; until then the previous version runs.
- A deployment must replace the icons and the manifest values before building, serve the client
  and the administration from different origins, and serve `/sw.js` and `index.html` with
  `Cache-Control: no-cache` so that a new version is found.

## Alternatives considered

- A hand-written service worker: rejected. The list of files to precache and their revisions are
  error-prone; the standard plugin already does it.
- Automatic update (immediate activation and reload): rejected. An unexpected reload can interrupt
  a form; the update happens on a click.
- Caching the API (stale-while-revalidate, or network first with a fallback copy): rejected. A
  stale quote, tracking view or order would be wrong.
- Caching the map tiles: rejected. Too large, and the address screen needs the network for the
  quote anyway.
- Precaching MapLibre: rejected. More than 1 MB sent to every phone at installation, over mobile
  data.
- `networkMode: "always"` in TanStack Query: rejected. A failed refresh on returning to the tab
  could replace data already loaded with an error; the default behaviour keeps them.
- An offline order queue or background synchronisation: rejected. The price is computed by the
  server, and an order requires the network.
- A PWA for the administration: rejected. It is a desktop tool, and a service worker of the client
  would intercept its pages if the origin were shared.
