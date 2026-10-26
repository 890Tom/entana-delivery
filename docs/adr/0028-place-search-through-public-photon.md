# 0028. Place search through the public Photon instance

- Status: accepted
- Date: 2026-10-25

## Context

The customer app (MAP-1b) and the admin (MAP-2) need address suggestions on the delivery map: a customer types a place, picks a suggestion, and the map moves to it. The project has no list of addresses of its own and does not use PostGIS (ADR 0006). The constraints:

- no new dependency;
- no secret or account to create for each shop;
- no change to the Content-Security-Policy of the pages (ADR 0026);
- no personal data in the logs.

## Decision

- **One public endpoint**, `GET /api/v1/places/search?q=`, answered by the API. The browsers never call the provider: the CSP keeps one outside origin (the tiles).
- **Provider: the public instance of Photon** (`https://photon.komoot.io/api/`, OpenStreetMap data, no key). The base URL is a named constant in a single adapter, `apps/api/src/places/provider/photon-place-search.ts`. There is no environment variable.
- **What is sent**: the typed text (trimmed, 3 to 100 characters), the map centre of the instance configuration as `lat`/`lon`, `limit=10` and `lang=fr`. The address of the customer is not sent: the request comes from the server.
- **What is answered**: at most 5 suggestions `{ label, lat, lng }` whose `countrycode` is `MG`, in the order of the provider. The label is the name, the street and the city, without empty parts or exact repeats, at most 200 characters. A malformed result is dropped. There is no distance filter.
- **Failures**: a network error, a redirect, a status other than 2xx, an unreadable body, a body without `features`, or no answer within 3 seconds (body included) give a 503 with the problem type `urn:entana:problem:place_search_unavailable` and a fixed text that never names the provider.
- **Limits and privacy**: 60 requests per address in 10 minutes, with the existing in-memory limiter (`SlidingWindowLimiter`), answered with the usual 429 and `Retry-After`. Neither the text nor the address is logged. Answers are not cached (`Cache-Control: no-store`, nothing kept on the server).

## Consequences

- No account or key to manage, and the shops get suggestions with no setup beyond the map centre they already have.
- **What customers type leaves the server**: it goes to komoot's Photon service, a third party, under its fair-use terms. A shop that cannot accept this needs another provider, which means changing the one adapter file.
- **The API needs outbound HTTPS access** to `photon.komoot.io`. In production it has it through the `edge` network (ADR 0027), not the `internal` one. Moving the API to the internal network only would make every search answer 503.
- The public instance has no availability guarantee and limits heavy use. There is no global limit across addresses and no cache, so a busy shop could be throttled; the suggestions would then answer 503 until the provider accepts requests again.
- The limit is counted per API process, like the other limits.
- Self-hosted map tiles do not change place search: it stays an external service called by the API (ADR 0030).

## Alternatives considered

- **Calling Photon from the browser**: the provider would see the IP address of every customer, and the CSP would need a second outside origin.
- **Nominatim (OpenStreetMap)**: its usage policy forbids search-as-you-type on the public instance.
- **A commercial geocoder** (with a key): an account and a secret for each shop, and a cost, for a need the free public data covers today.
- **A self-hosted Photon**: several gigabytes of data and one more service to run for each shop, too heavy for a small shop's server.
- **A cache of the answers**: left out for now, because a typed address is personal data and the volume of a shop is small.
