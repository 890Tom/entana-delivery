# 0030. Self-hosted map tiles

- Status: accepted
- Date: 2026-10-26

## Context

The basemap of the customer app and of the administration comes from a public third-party tile host, OpenFreeMap. Its address is in the Content-Security-Policy of the pages (ADR 0026). Its availability and its terms of use are outside the control of the project.

The goal is that an instance can serve its own tiles, from its own server.

Place search (Photon, ADR 0028) is not concerned: it stays an external service called by the API.

## Decision

- **The tiles are one PMTiles archive**: a Protomaps build, extracted for Madagascar, up to zoom 15. Caddy serves it from a folder of the host mounted read-only under `/maps`, with HTTP range requests. The archive is never in the repository nor in the image.
- **The style is generated** by `deploy/maps/generate-style.mjs` from `@protomaps/basemaps`: light theme, labels in French, no sprite (the icons of the basemap are removed). The fonts are the PBF files of `protomaps/basemaps-assets`. The style and the fonts are served under `/maps` too.
- **The browser reads the archive with the `pmtiles` library**, registered as a MapLibre protocol once per page in the map loader. The loader is written separately in the customer app and in the administration (ADR 0018). The library is a chunk named `pmtiles`, outside the initial bundle and outside the precache of the service worker (ADR 0023).
- **The instance chooses its style with `map.styleUrl`.** The default stays the OpenFreeMap style, so that a new installation works without an archive.
- **The Content-Security-Policy does not change**: `/maps` is on the same origin, covered by `'self'`. The OpenFreeMap host stays allowed as long as it is the default style.

## Consequences

- The archive of Madagascar up to zoom 15 is about 605 MB. By maximum zoom: about 55 MB at 12, 146 MB at 13, 290 MB at 14 and 605 MB at 15; Antananarivo alone up to zoom 15 is about 17 MB.
- Beyond zoom 15 the map is enlarged, not more detailed.
- Setting up and updating the tiles are manual steps, described in `deploy/maps/README.md` and in `deploy/lightsail.md`.
- Files under `/maps` are cached for one hour, so a new archive takes a new file name and a regenerated style; an archive is never replaced in place.
- The basemap shows no point-of-interest icons.
- The style carries the attribution of OpenStreetMap and Protomaps.
- The map data grows old until the archive is extracted again.

## Alternatives considered

- **Keeping OpenFreeMap only:** the basemap would stay in the hands of a third party.
- **A commercial tile API:** an API key and a quota to manage.
- **A dedicated vector tile server:** one more service to run.
- **Raster tiles:** not retained; the archive, the generated style and the maps of the applications stay vector.
