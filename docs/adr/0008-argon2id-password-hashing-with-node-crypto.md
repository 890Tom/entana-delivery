# 0008. Argon2id password hashing with Node's built-in crypto

- Status: accepted
- Date: 2026-10-05
- Note: the module now lives in `packages/password-hash` (`@entana/password-hash`), see [ADR 0015](0015-password-hash-in-its-own-package.md).

## Context

The seed script creates the first admin account, and the API will verify the same hash at login in a later step, so the format must be settled now. The current OWASP Password Storage Cheat Sheet recommends, in this order: Argon2id (at least m=19456 KiB, t=2, p=1, or an equivalent trade-off), then scrypt (N=2^17, r=8, p=1), then bcrypt (work factor 10 or more, input limited to 72 bytes), then PBKDF2.

Node 24 has a built-in `crypto.argon2` and `crypto.argon2Sync` (added in v24.7.0). On a development machine, hashing with the OWASP parameters took about 20 ms, against about 290 ms for the scrypt minimum. Adding a dependency needs approval in this project (CLAUDE.md), and pnpm blocks install scripts by default (ADR 0006).

## Decision

- Hash passwords with **Argon2id** through `node:crypto`, with m=19456 KiB, t=2, p=1, a random 16-byte salt and a 32-byte tag. No dependency is added.
- Store the result as a standard **PHC string**: `$argon2id$v=19$m=19456,t=2,p=1$<salt>$<hash>` (base64 without padding). Parameters travel with the hash, so they can be raised later and old hashes still verify.
- The code lives in `packages/database/src/password-hash.ts` (`hashPassword`, `verifyPassword`), exported as `@entana/database/password-hash` so the API reuses it. `verifyPassword` compares in constant time and returns `false`, never throws, for a wrong password or a malformed stored value.
- Raise `engines.node` to `>=24.7`, the first release with the function.
- `verifyPassword` refuses a stored hash whose parameters are out of bounds (memory above 1 GiB, more than 10 passes or 16 lanes, a salt under 8 bytes, a tag under 16 bytes) before hashing anything, so a corrupted row cannot make a login allocate gigabytes.
- A test checks Node's Argon2id against the RFC 9106 test vector, as evidence that hashes made here can be verified by any other standard implementation.

## Consequences

- No new dependency, no native binary, nothing for pnpm to block, and the OWASP first choice.
- We write about 40 lines of encoding and verification ourselves, covered by tests.
- The login handler of the API must also run a dummy `verifyPassword` against a constant valid hash when the username does not exist (so the response time does not reveal accounts), limit the rate of attempts, and cap the length of a password.
- Each login uses about 19 MiB of memory for a moment. The API should limit concurrent logins (it already locks an account after 5 failures, see `docs/data-model.md`).
- Moving to a library later is possible without a data migration, because the PHC format is the standard one.
- `crypto.argon2` was added in Node 24.7.0 as a regular (semver-minor) API. Neither the 24.7.0 release notes nor the type declarations mark it experimental, and it runs without any warning. The stability line of the API reference page could not be read when this was written: if it is ever marked unstable, revisit this decision.

## Alternatives considered

- **scrypt (`node:crypto`):** no dependency either, but it needs 128 MiB per hash and about 14 times more CPU time per hash here, which makes a burst of logins easier to abuse. It is OWASP's second choice.
- **Argon2id through a library (`@node-rs/argon2`, `argon2`):** a ready-made PHC encoding, but a new dependency with native binaries, for something Node now does itself.
- **bcrypt:** the weakest of the options, it silently truncates passwords at 72 bytes, and needs a dependency.
- **PBKDF2:** built in, but not memory-hard, and OWASP lists it last.
