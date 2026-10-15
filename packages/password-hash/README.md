# @entana/password-hash

Argon2id password hashing with Node's built-in `crypto.argon2` (Node 24.7 or later), no npm dependency. Used by the API (login, `admin:upsert`) and by the seed. Decisions: [ADR 0008](../../docs/adr/0008-argon2id-password-hashing-with-node-crypto.md) (algorithm and parameters) and [ADR 0015](../../docs/adr/0015-password-hash-in-its-own-package.md) (why a package of its own).

```sh
pnpm --filter @entana/password-hash build
pnpm --filter @entana/password-hash test
pnpm --filter @entana/password-hash test:coverage
```

## What it exports

- `hashPassword(password)`: a PHC string, `$argon2id$v=19$m=19456,t=2,p=1$<salt>$<hash>`.
- `verifyPassword(password, storedHash)`: compares in constant time, using the parameters stored in the hash.
- `ARGON2ID_PARAMETERS`: the parameters used for new hashes.

## Points of attention

- The parameters read from a stored hash are bounded, so that a corrupted row cannot make a login allocate gigabytes of memory.
- A compatibility test holds a literal hash: a change that would stop verifying existing hashes fails it.
