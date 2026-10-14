# Data model

This document is the reference for the database schema. It describes 13 tables, grouped by domain. Money is an integer number of ariary (no decimals). Timestamps are `timestamptz` stored in UTC. The delivery date is a plain day (`date`), interpreted in the `Indian/Antananarivo` time zone by the application. Identifiers are UUIDs. Rows are never deleted (except the sessions of the administration, see `admin_session`, and the resellers, see ADR 0020): products, axes and places are deactivated or archived, so history stays intact. Foreign keys use `ON DELETE RESTRICT`.

## Orders

### `customer`
| Column | Type | Rules |
|---|---|---|
| id | uuid | primary key |
| phone_e164 | text | unique, E.164 format, `ck_customer_phone_e164_format`: `CHECK (phone_e164 ~ '^\+[1-9][0-9]{6,14}$')` |
| trust_level | enum `NEW`, `KNOWN`, `BLOCKED` | default `NEW` |
| created_at | timestamptz | default now |

A customer is created automatically on the first order. There is no customer account and no name: the name typed for each order is stored on the order.

### `customer_order`
| Column | Type | Rules |
|---|---|---|
| id | uuid | primary key |
| public_token_hash | text | unique; SHA-256 of the tracking token, the token itself is never stored |
| public_code | text | unique; 6 characters (the length is a CHECK, the alphabet is an application rule) |
| customer_id | uuid | foreign key to `customer` |
| place_id | uuid, nullable | foreign key to `place`; null when no place matches |
| axis_id | uuid, nullable | foreign key to `delivery_axis`; null outside an axis |
| delivery_fee | integer | >= 0, frozen at creation |
| fee_reason | enum `IN_AXIS`, `OUT_OF_AXIS`, `QUANTITY`, `ADJUSTED` | frozen at creation; `QUANTITY`: free outside every axis from the piece threshold, with `place_id` and `axis_id` null |
| delivery_date | date, nullable | null until the order is confirmed |
| status | enum | `NEW`, `CONFIRMED`, `OUT_FOR_DELIVERY`, `DELIVERED`, `REJECTED`, `CANCELLED`, `FAILED` |
| status_reason | text, nullable | reason of a refusal, cancellation or failed delivery |
| contact_name | text | name typed for this order |
| customer_note | text, nullable | note for the delivery person |
| driver_id | uuid, nullable | foreign key to `staff_user`; used from the driver phase |
| tour_position | integer, nullable | used from the driver phase |
| lat, lng | double precision | position chosen by the customer |
| landmark_text | text | required, a written landmark |
| total_ar | integer | >= 0; items total + delivery fee, recomputed by the server on every write |
| idempotency_key | text | unique; the same key never creates a second order |
| created_at | timestamptz | default now |

Constraints (hand-written migration `add_check_constraints`, see ADR 0007):
- `ck_customer_order_delivery_date_when_confirmed`: `CHECK (status IN ('NEW','REJECTED','CANCELLED') OR delivery_date IS NOT NULL)`. A cancelled order may never have been confirmed, so it has no delivery date either.
- `ck_customer_order_reason_when_closed_unhappily`: `CHECK (status NOT IN ('REJECTED','CANCELLED','FAILED') OR status_reason IS NOT NULL)`
- `ck_customer_order_amounts_not_negative`: `CHECK (delivery_fee >= 0 AND total_ar >= 0)`
- `ck_customer_order_public_code_length`: `CHECK (char_length(public_code) = 6)`

Indexes:
- Plain composite index on `(status, delivery_date, axis_id)`. It is not a partial index: see ADR 0007.
- Index on `customer_id`.

### `order_item`
| Column | Type | Rules |
|---|---|---|
| id | uuid | primary key |
| order_id | uuid | foreign key to `customer_order` |
| product_id | uuid | foreign key to `product` |
| product_name | text | name frozen at order time |
| qty | integer | > 0 (`ck_order_item_qty_and_price`) |
| unit_price | integer | >= 0 (same constraint), frozen at order time |

### `order_event`
| Column | Type | Rules |
|---|---|---|
| id | uuid | primary key |
| order_id | uuid | foreign key to `customer_order` |
| type | enum `STATUS_CHANGED`, `LINES_EDITED`, `FEE_ADJUSTED`, `DATE_CHANGED` | |
| from_status, to_status | enum status, nullable | set for `STATUS_CHANGED` |
| actor_type | enum `STAFF`, `CUSTOMER`, `SYSTEM` | |
| actor_id | uuid, nullable | no foreign key: a staff account or a customer depending on `actor_type` |
| payload | jsonb | old and new values, reason |
| client_event_id | uuid, nullable | unique when present; idempotency of actions sent offline by the driver app |
| client_ts | timestamptz, nullable | client-side timestamp |
| created_at | timestamptz | default now |

Written in the same transaction as the change it records. Index on `(order_id, created_at)`. Constraint `ck_order_event_to_status_when_status_changed`: `CHECK (type <> 'STATUS_CHANGED' OR to_status IS NOT NULL)`.

## Catalogue

### `product`
| Column | Type | Rules |
|---|---|---|
| id | uuid | primary key |
| sku | text | unique; reconciliation key with an external stock system |
| name | text | |
| description | text, nullable | the short description (0 to 120 characters, validated by the API; empty means null) |
| price_ar | integer | > 0 (`ck_product_price_positive`) |
| active | boolean | visible in the catalogue |
| available | boolean | set manually, never reset automatically |
| availability_changed_at | timestamptz | |
| position | integer | display order |
| image_key | text, nullable | required to make the product visible; the name of the photo file in the products media folder (png, webp or jpg, no path), turned into `/media/products/<key>` by the API. A photo sent through the administration is a `<random>.webp` |
| image_alt | text, nullable | required to make the product visible |

Constraint `ck_product_photo_when_active`: `CHECK (active = false OR (image_key IS NOT NULL AND image_alt IS NOT NULL))`. A visible product always has a photo and its alternative text.

## Delivery

### `place`
| Column | Type | Rules |
|---|---|---|
| id | uuid | primary key |
| name | text | 1 to 60 characters (`ck_place_name_length`), unique without regard to case (index `place_name_lower_key` on `lower(name)`) |
| lat | double precision | centre of the place, `ck_place_latitude_range`: between -90 and 90 |
| lng | double precision | centre of the place, `ck_place_longitude_range`: between -180 and 180 |
| radius_m | integer | default 500, `ck_place_radius_range`: `CHECK (radius_m BETWEEN 100 AND 3000)` |
| active | boolean | an inactive place covers no address |

### `delivery_axis`
| Column | Type | Rules |
|---|---|---|
| id | uuid | primary key |
| name | text | 1 to 60 characters (`ck_delivery_axis_name_length`), unique without regard to case (index `delivery_axis_name_lower_key`) |
| rank | integer | priority, 1 is the highest, `ck_delivery_axis_rank_positive`: `>= 1`. Unique (`delivery_axis_rank_key`, deferrable so that two ranks can be swapped in one transaction). When an address is in several axes, the lowest rank wins |
| active | boolean | an inactive axis serves no address |
| color | text | chosen by the administration, `#rrggbb` in lower case (`ck_delivery_axis_color_format`). Not unique: two axes may share a colour |

The number of axes is not limited (ADR 0022).

### `axis_place`
| Column | Type | Rules |
|---|---|---|
| axis_id | uuid | foreign key to `delivery_axis` |
| place_id | uuid | foreign key to `place` |
| position | integer | rank of the place along the axis |

Primary key `(axis_id, place_id)`: a place appears at most once in an axis, and can belong to several axes.

## Administration, resellers and settings

### `staff_user`
| Column | Type | Rules |
|---|---|---|
| id | uuid | primary key |
| name | text | |
| username | text | unique; the accounts made by the `admin:upsert` script copy their e-mail here |
| email | text, nullable | unique, used to log in to the administration; null for a driver. `ck_staff_user_email_form`: `CHECK (email IS NULL OR (email = lower(btrim(email)) AND char_length(email) BETWEEN 3 AND 254 AND email LIKE '%_@_%'))` |
| phone | text, nullable | |
| role | enum `ADMIN`, `DRIVER` | |
| password_hash | text | |
| failed_login_count | integer | default 0, `ck_staff_user_failed_login_count_not_negative`: `CHECK (failed_login_count >= 0)` |
| locked_until | timestamptz, nullable | set after 5 failed logins (15 minutes) |
| active | boolean | |
| created_at, updated_at | timestamptz | default now |

Only an account with role `ADMIN`, `active` and an `email` can log in to the administration. `failed_login_count` and `locked_until` are not used by that login: its limits are kept in memory (ADR 0017).

### `admin_session`
| Column | Type | Rules |
|---|---|---|
| id | uuid | primary key |
| token_hash | text | unique, SHA-256 of the session token as 64 lowercase hexadecimal characters, `ck_admin_session_token_hash_form`: `CHECK (token_hash ~ '^[0-9a-f]{64}$')`; the token itself is never stored |
| staff_user_id | uuid | foreign key to `staff_user`, indexed |
| created_at | timestamptz | default now |
| expires_at | timestamptz | indexed; absolute end, 7 days after creation; `ck_admin_session_expires_after_creation`: `CHECK (expires_at > created_at)` |
| last_seen_at | timestamptz | default now; written at most once a minute; `ck_admin_session_last_seen_not_before_creation`: `CHECK (last_seen_at >= created_at)` |
| revoked_at | timestamptz, nullable | set by the logout; `ck_admin_session_revoked_not_before_creation`: `CHECK (revoked_at IS NULL OR revoked_at >= created_at)` |

A session is usable while it is not revoked, before `expires_at`, and seen less than 12 hours ago (pure rule `evaluateAdminSession` in `contracts`). A session is not business data: the sessions that are expired, idle or revoked are deleted at each successful login, with no scheduled task.

### `audit_log`
| Column | Type | Rules |
|---|---|---|
| id | uuid | primary key |
| actor_id | uuid | foreign key to `staff_user` |
| action, entity | text | |
| entity_id | uuid | |
| diff | jsonb | |
| at | timestamptz | default now |

Only actions outside orders (catalogue, axes and places, resellers, settings, accounts, logins). Everything about an order goes to `order_event`.

Written so far, with `entity = "product"`: `product.created`, `product.updated` (`diff.fields` lists the changed fields, `diff.priceAr` the old and new price), `product.availability_changed`, `product.retired`, `product.restored` (`diff` holds the before and after of the flag: `available` or `active`) and `product.photo_replaced`.

Written so far, with `entity = "reseller"`: `reseller.created` (`diff` holds `visible` and `consentGiven`), `reseller.updated` (`diff.fields` lists the changed fields), `reseller.consent_changed` and `reseller.published` / `reseller.unpublished` (`diff` holds the before and after of the flag), `reseller.verified` and `reseller.deleted` (`diff` is empty: the entry keeps the id only, no name and no position).

### `reseller`
| Column | Type | Rules |
|---|---|---|
| id | uuid | primary key |
| name, area, landmark_text | text | all required |
| lat, lng | double precision | |
| active | boolean | visible on the public map |
| consent_at | timestamptz, nullable | publication consent |
| verified_at | timestamptz, nullable | last verification |

Constraint `ck_reseller_consent_when_active`: `CHECK (active = false OR consent_at IS NOT NULL)`.

### `shop_setting`
| Column | Type | Rules |
|---|---|---|
| id | integer | primary key, a single row |
| out_of_axis_fee_ar | integer | >= 0, default 4000. Flat fee outside every axis |
| free_delivery_min_pieces | integer | >= 1 (`ck_shop_setting_free_delivery_min_pieces`), default 20. Delivery is free from this number of pieces |
| out_of_axis_message | text | plain text, 1 to 200 characters once trimmed (`ck_shop_setting_message_length`). Default: « Votre adresse est hors de nos axes de livraison : des frais de livraison s'appliquent. » The only delivery text the administration can change |
| updated_at | timestamptz | default `now()` |

Constraint `ck_shop_setting_single_row_and_fee`: `CHECK (id = 1 AND out_of_axis_fee_ar >= 0)`. The migration creates the row with the default values (and keeps an existing one), so the application updates it and never inserts it.

## Rules enforced by the application, not the database

- `total_ar` equals the sum of the items plus `delivery_fee` (recomputed by the server, covered by a unit test).
- `public_code` uses an alphabet without ambiguous characters (no `0`, `O`, `1`, `I`); the database only checks the length.
- Status transitions are valid and happen one step at a time (shared pure function).
- `resolveDeliveryAxis` (the active axis of the lowest rank with an active place whose radius covers the point, and in it the closest place) and `computeDeliveryFee` (free in an axis, free from the piece threshold, the flat fee otherwise) are pure functions of `packages/contracts`. The values (radius, threshold, fee) are parameters read from the database. The result is frozen on the order: changing an axis, a place or a setting never changes a past order. Branching them on the creation of an order comes later.

## Seed data (fake)

Created by `pnpm db:seed` (see `packages/database/README.md`): six products (one out of stock, one hidden), nineteen fictional places in four delivery axes (Axe Nord, Axe Est, Axe Sud, Axe Ouest, with three places shared by two axes), the settings with their default values, five customers with fake phone numbers (the `+44 7700 900xxx` range reserved for drama), eight orders with their items and events: 2 new, 2 confirmed, 1 out for delivery, 1 delivered, 1 rejected, 1 cancelled, six resellers, an admin account and an inactive driver account. The admin password is random and printed once by the script. No real business, person or number.

An order creation is recorded as a `STATUS_CHANGED` event with `from_status` null, `to_status` `NEW` and `actor_type` `CUSTOMER`, because `ck_order_event_to_status_when_status_changed` requires a target status on that type.
