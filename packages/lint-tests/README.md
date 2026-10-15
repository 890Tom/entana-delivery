# @entana/lint-tests

Tests of the root ESLint configuration (`eslint.config.mjs`). They lint small code fixtures with the real configuration and check that each guarded rule reports where expected, that safe code is not reported, and that the rules stay switched on as errors. Private, never imported by other packages.

```sh
pnpm --filter @entana/lint-tests test
pnpm --filter @entana/lint-tests typecheck
```

- `tests/support/`: the fixture rows and the harness that runs ESLint on them.
- The fixtures run without type information, so type-aware rules are covered by `pnpm lint` on the real files instead.
