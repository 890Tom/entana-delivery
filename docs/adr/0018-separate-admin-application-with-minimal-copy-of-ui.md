# 0018. A separate administration application, with a minimal copy of the interface primitives

- Status: accepted
- Date: 2026-10-12

## Context

The people of the shop need an administration next to the customer application. It is called on its own origin, through a proxy, with the session cookie of [ADR 0017](0017-admin-sessions-in-database-with-an-opaque-cookie.md); its audience, its security needs and its release rhythm are not those of the customer application. Both front ends share the rules and schemas of `packages/contracts` ([ADR 0011](0011-validation-with-standard-schema-and-shared-zod-contracts.md)) and the design tokens.

The first screen of the administration needs four interface primitives that already exist in `apps/client`: a button, a text field, a notice and the visually hidden text.

## Decision

1. **A second application, `apps/admin`**, built with the same chain as `apps/client` (React, Vite pinned to the same version, wouter, TanStack Query, Vitest with jsdom). It depends on `packages/contracts` only and never on `apps/client` (`front-ends-only-import-contracts` and `apps-do-not-import-each-other` of dependency-cruiser already say so).
2. **A minimal copy of the primitives, no shared interface package for now.** The administration copies only what the sign-in needs, trimmed to that need (the button has no link or icon variant; the text field is single-line, with an action inside the border for "Afficher"; the notice has two tones). The tokens, the base style and the self-hosted font are copied as they are, so that the same private `theme.local.css` values apply to both.
3. **A shared package is the way out, not the start.** When a third screen of the administration needs more of these primitives, or the two copies start to drift in a way that costs, the primitives move to a package that both applications import, in their own pull request.
4. **Same origin, same-origin cookie.** The browser always calls its own origin: the Vite development server forwards `/api` and `/media` to the API (`ADMIN_DEV_API_TARGET`, `http://127.0.0.1:3000` by default). The development origin of the administration is `http://localhost:5174`, which is also the default of `ADMIN_ALLOWED_ORIGINS` outside production. CORS with credentials stays off.
5. **Nothing is kept in the browser.** The session is read from the server (`/api/v1/admin/auth/me`); no `localStorage`, `sessionStorage` or readable cookie is written; the "session ended" message lives in memory.

## Consequences

- About a dozen files are duplicated between the two applications. A fix to one primitive must be made twice until step 3 happens.
- The client is untouched: no risk to the customer journey, a small pull request.
- Each application has its own `theme.local.css` (`apps/<app>/public/`, git-ignored): a deployment places its theme next to each of them.

## Alternatives considered

- **A shared interface package now.** Moves about 14 files out of the client and edits about 25 imports there, adds a workspace package with its own configuration, and needs the dependency rules relaxed. Too large for a first screen; kept as the way out (decision 3).
- **Routes of the administration inside `apps/client`.** One bundle, no copy, but the customer application would carry the administration's code and cookie logic, and a shared origin would blur the same-origin rules of ADR 0017.
