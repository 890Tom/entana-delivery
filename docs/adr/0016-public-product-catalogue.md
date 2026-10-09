# 0016. Public product catalogue

- Status: accepted
- Date: 2026-10-07

## Context

Customers browse the catalogue without an account. `GET /api/v1/products` is public, so everything it returns is visible to anyone. The `product` table also holds internal columns (`sku`, `position`, `active`, `availability_changed_at`, see [`docs/data-model.md`](../data-model.md)). The shared shapes live in `packages/contracts` ([ADR 0011](0011-validation-with-standard-schema-and-shared-zod-contracts.md)), and the database is reached through `DatabaseModule` ([ADR 0013](0013-database-access-and-health-endpoints.md)).

## Decision

1. **Strict public contract.**
   - `publicProductSchema` and `productListResponseSchema` (`packages/contracts/src/catalog`) are `z.strictObject`s.
   - A product has `id`, `name`, `description` (nullable), `priceAr`, `available` and `image: { url, alt }`. `sku`, `position`, `active` and `availabilityChangedAt` are never exposed.
   - The list is an object, `{ products: [...] }`, not a bare array. The tests refuse a bare array, an extra property next to `products`, and a product carrying a `sku` (`product-list-response.test.ts`, `public-product.test.ts`).
2. **The `select` is the protection, the schema is not.**
   - `CatalogService.listActiveProducts` (`apps/api/src/catalog/catalog.service.ts`) reads an explicit list of seven columns, so `sku` never leaves the database.
   - The schema is not applied to responses at runtime. It types the result, feeds the OpenAPI document and is checked in tests.
   - `catalog.integration.test.ts` ("asks the database for the public columns only…") pins the selected keys.
3. **Pure mapper** (`catalog/mapping/to-public-product.ts`).
   - A `null` or blank description (no non-whitespace character) becomes `null`. Any other text is returned unchanged, without trimming.
   - `image` is never `null` for an active product: `ck_product_photo_when_active` forbids a row without photo ([`docs/data-model.md`](../data-model.md), [ADR 0007](0007-check-constraints-in-a-hand-written-migration.md)).
   - A row without `imageKey` or `imageAlt` raises `IncompleteActiveProductError`, whose fixed message holds no row data. The error filter answers the generic `500`, with no row data in the body (`products.e2e.test.ts`).
4. **Deterministic order.** `orderBy` is `position`, then `name`, then `id`, so the order is total (`catalog.integration.test.ts`). Unavailable products are included with `available: false`.
5. **One connection pool.**
   - `DatabaseModule` is not global. `HealthModule` and `CatalogModule` both import `DatabaseModule.register(config)`.
   - `register` memoises its `DynamicModule` in a `WeakMap` keyed by the `AppConfig` object. Nest then sees one module, so one client and one pool.
   - A copy of the config (`{ ...config }`) is another key, hence another pool.
   - `database.module.test.ts` checks that the same config gives the same module and a copied one does not. `products.e2e.test.ts` ("builds one database client for the whole application…") checks that `app.get(DATABASE_CLIENT, { each: true })` returns exactly one client.
6. **Cache-Control.**
   - A success carries `Cache-Control: public, max-age=30` (`CATALOG_CACHE_CONTROL` in `catalog.controller.ts`). The answer is the same for every visitor, so shared caches may keep it.
   - Errors never carry it. Nest applies `@Header` before the handler runs, so `send-problem.ts` overwrites it with `no-store` on every error answer (`products.e2e.test.ts`: the 500 and the unknown route).
   - **Open:** the 30 seconds are not confirmed with the shop owner. They set how long a visitor can see an old price or availability. The controller comment records the same.

## Consequences

- A column added to `product` is not public until it is added to the `select`, the mapper and the contract.
- Because the schema is not applied at runtime, the `select` and the mapper are the only protection. Their tests (items 2 and 3) are the guard.
- No pagination: every active product is returned (`catalog.service.ts`, one `findMany` without `take`). This is intended for a shop-sized catalogue.
- `image.url` is the photo address, built by the API from the stored key (`public-product.ts`); the key itself is not exposed.
- The data is the same for every visitor: no per-user content, so `public` caching is safe.
- Pool sharing depends on passing the same `AppConfig` object to every module. The two tests of item 5 fail otherwise.

## Alternatives considered

- **Decorated DTO classes instead of shared schemas.** Not chosen: they cannot be shared with the front ends and describe each shape twice ([ADR 0011](0011-validation-with-standard-schema-and-shared-zod-contracts.md)).
- **A global `DatabaseModule`.** Not chosen: a module that needs the database imports it, so the dependency is visible (comment in `database.module.ts`).

_Updated on 2026-10-09 by task I3: the contract returns `image.url`, built by the API from the key (`/media/products/<file>`, key checked against the media file name pattern)._
