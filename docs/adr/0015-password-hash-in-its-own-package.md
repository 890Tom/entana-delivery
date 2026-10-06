# 0015. Password hashing in its own package

- Status: accepted
- Date: 2026-10-06

## Context

ADR 0008 put the password hashing module in `packages/database` and exported it as
`@entana/database/password-hash`. The database package is about persistence, and the module has
nothing to do with it. Its only consumer today is the seed script, and the API will verify
passwords at login later: it would have to reach hashing through a package named after the
database, and the module is the one piece of code that must keep its output stable for years.

## Decision

- Move the module, with its tests, to `packages/password-hash` (`@entana/password-hash`). It is a
  pure move: same algorithm (Argon2id through `node:crypto`), same parameters, same PHC format,
  same function names and signatures. Nothing is added to the dependencies (there is none).
- The package follows the pattern of `@entana/contracts`: `dist/` built by `tsc`, `exports` with
  `types` pointing to `src`.
- Dependency direction: `password-hash` is a leaf. It imports no application and no other
  workspace package (`pnpm lint:architecture` enforces it). `packages/database` (the seed) and the
  applications may import it. `@entana/database` no longer exposes `./password-hash`.
- A test holds a literal hash produced by the previous implementation, so a later change cannot
  silently make existing admin hashes unverifiable.

## Consequences

- The API will depend on `@entana/password-hash` directly, not through the database package.
- `@entana/database` has a development dependency on the new package (the seed). Anything that
  installs the database package, such as the API image, must have the new manifest available.
- Running the seed needs the package to be built first (`pnpm build`).

## Alternatives considered

- **Keep it in `packages/database`:** nothing to change, but the API would couple to the
  database package for something unrelated.
- **Put it in `packages/contracts`:** contracts is pure shared rules and schemas and must stay
  free of Node-only code.
