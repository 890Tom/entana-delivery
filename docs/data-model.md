# Data model

This document is the reference for the database schema. It describes 12 tables, grouped by domain. Money is an integer number of ariary (no decimals). Timestamps are `timestamptz` stored in UTC. The delivery date is a plain day (`date`), interpreted in the `Indian/Antananarivo` time zone by the application. Identifiers are UUIDs. Rows are never deleted: products, axes, places and resellers are deactivated or archived, so history stays intact. Foreign keys use `ON DELETE RESTRICT`.

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
| fee_reason | enum `IN_AXIS`, `OUT_OF_AXIS`, `ADJUSTED` | |
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
| description | text, nullable | |
| price_ar | integer | > 0 (`ck_product_price_positive`) |
| active | boolean | visible in the catalogue |
| available | boolean | set manually, never reset automatically |
| availability_changed_at | timestamptz | |
| position | integer | display order |
| image_key | text, nullable | required to make the product visible |
| image_alt | text, nullable | required to make the product visible |

Constraint `ck_product_photo_when_active`: `CHECK (active = false OR (image_key IS NOT NULL AND image_alt IS NOT NULL))`. A visible product always has a photo and its alternative text.

## Delivery

### `place`
| Column | Type | Rules |
|---|---|---|
| id | uuid | primary key |
| name | text | |
| lat, lng | double precision | centre of the place |
| radius_m | integer | default 500, `ck_place_radius_range`: `CHECK (radius_m BETWEEN 100 AND 3000)` |
| active | boolean | |

### `delivery_axis`
| Column | Type | Rules |
|---|---|---|
| id | uuid | primary key |
| name | text | unique |
| position | integer | priority: when a place belongs to several axes, the lowest position wins |
| active | boolean | |

### `axis_place`
| Column | Type | Rules |
|---|---|---|
| axis_id | uuid | foreign key to `delivery_axis` |
| place_id | uuid | foreign key to `place` |
| position | integer | rank of the place along the axis |

Primary key `(axis_id, place_id)`. A place can belong to several axes.

## Administration, resellers and settings

### `staff_user`
| Column | Type | Rules |
|---|---|---|
| id | uuid | primary key |
| name | text | |
| username | text | unique, used to log in |
| phone | text, nullable | |
| role | enum `ADMIN`, `DRIVER` | |
| password_hash | text | |
| failed_login_count | integer | default 0, `ck_staff_user_failed_login_count_not_negative`: `CHECK (failed_login_count >= 0)` |
| locked_until | timestamptz, nullable | set after 5 failed logins (15 minutes) |
| active | boolean | |

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
| out_of_axis_fee_ar | integer | >= 0 |
| out_of_axis_message | text | |
| updated_at | timestamptz | |

Constraint `ck_shop_setting_single_row_and_fee`: `CHECK (id = 1 AND out_of_axis_fee_ar >= 0)`.

## Rules enforced by the application, not the database

- `total_ar` equals the sum of the items plus `delivery_fee` (recomputed by the server, covered by a unit test).
- `public_code` uses an alphabet without ambiguous characters (no `0`, `O`, `1`, `I`); the database only checks the length.
- Status transitions are valid and happen one step at a time (shared pure function).
- `quote` computes the place, the axis and the fee from a position; the result is frozen on the order.

## Seed data (fake)

Products (four flavours), three delivery axes made of fictional places, a few fake resellers, fake customers with obviously fake phone numbers, and one admin account whose random password is printed once by the seed script. No real business, person or number.
