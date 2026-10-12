# 0017. Administration sessions: opaque token in a cookie, session rows in the database

- Status: accepted
- Date: 2026-10-12

## Context

The people of the shop need to log in to the administration (task 6a-1). The product is single-tenant and self-hosted by a small business: one API process, one PostgreSQL, a reverse proxy in front, and an administration served from the same origin as the API. The data model already holds a `staff_user` table (name, username, role `ADMIN` or `DRIVER`, `password_hash`, `active`), referenced by `customer_order.driver_id` and `audit_log.actor_id`, and `order_event.actor_id` points at a staff account when `actor_type` is `STAFF`.

## Decision

- **One identity table.** `staff_user` is extended with a unique, normalised `email` (`ck_staff_user_email_form`) and `created_at`/`updated_at`; no `admin_user` table is added. Only `role = ADMIN`, `active` and an e-mail can log in. In 6b an order event written by an admin uses `actor_type = STAFF` and `actor_id = staff_user.id`, with no migration. `username` is kept (the column is not null and unique): the `admin:upsert` script copies the e-mail into it. `failed_login_count` and `locked_until` stay unused: the limits are in memory.
- **Opaque session token, not a JWT.** 32 random bytes (CSPRNG) in base64url, in a cookie. The database holds only its SHA-256 (`admin_session.token_hash`, `ck_admin_session_token_hash_form`). A session can be revoked at once (logout, disabling an account, changing a password), which a signed stateless token cannot do without a deny list.
- **Cookie.** `HttpOnly; SameSite=Strict; Path=/`, `Secure` and the `__Host-` prefix in production (configurable for local HTTP), no `Domain`, written by hand: a few lines, no parsing package.
- **Lifetimes.** 7 days absolute (`expires_at`), 12 hours of inactivity, `last_seen_at` written at most once a minute through a conditional `UPDATE`. The rules are pure functions of `contracts` (`evaluateAdminSession`) that receive the clock. Expired, idle and revoked sessions are deleted in the transaction of each new login: a session is not business data, so this is the exception to "rows are deactivated, not deleted" (standards, section 8), and it needs no scheduled task.
- **Closed by default.** A global guard decides on the request path (`/api/v1/admin`, case, slashes and percent-encoding normalised), and a route opens only with `@adminPublic()`: the login, and the logout, which must answer `200` without a session to be idempotent.
- **CSRF.** `SameSite=Strict` plus an `Origin` check on every request that changes something under `/api/v1/admin`: a present `Origin` must be in `ADMIN_ALLOWED_ORIGINS`; a request with no `Origin` and the session cookie is refused. The administration is called same-origin (proxy), so CORS with credentials is deliberately not enabled.
- **Limits in memory.** Per address (10 attempts, 10 minutes) and per account (10 failed logins, 15 minutes), on the existing `SlidingWindowLimiter`, which gains a read-only `isKeyLimited`. Single instance, as the other limits.
- **No account enumeration.** One `401` for every cause, and a password verification against a hash of the same cost when the account is unknown.
- **Accounts by a script.** `admin:upsert` (compiled with the API, so it also runs in the image), password typed hidden and twice. No sign-up route, no reset by e-mail.

## Consequences

- A login is a few queries, and every admin request reads one session row. Fine for a shop; a shared cache would be needed for many instances, as for the limits.
- Anyone who knows an admin's e-mail can lock that account for 15 minutes by failing logins. Accepted, and documented in the API README.
- The API image now contains `@entana/password-hash` (its manifest and `dist`).
- `ADMIN_ALLOWED_ORIGINS` is required in production.

## Alternatives considered

- **A separate `admin_user` table:** two tables for the same people, and an ambiguous `actor_id`.
- **JWT in a cookie or header:** no immediate revocation, and a secret to rotate.
- **A scheduled task to delete sessions:** one more moving part for a table that stays small.
- **A cookie package:** a dependency for a header parser of fifteen lines.
