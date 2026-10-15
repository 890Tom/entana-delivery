# @entana/contracts

The shared Zod schemas and pure domain rules, used by the API and both front ends. One source of truth for the shape of every request and answer, and for the business rules.

```sh
pnpm --filter @entana/contracts build           # dist/
pnpm --filter @entana/contracts typecheck
pnpm --filter @entana/contracts test
pnpm --filter @entana/contracts test:coverage   # 90% floor
```

## Structure

One folder per domain under `src/`, all exported from `src/index.ts`:

- `catalog/`, `resellers/`: public and administration schemas of products and resellers, with their update plans.
- `delivery/`: the quote and zones schemas, `resolveDeliveryAxis`, `computeDeliveryFee`, the settings and the administration of axes.
- `orders/`: order creation, order code, phone numbering, totals, tracking, administration list and detail, status transitions (`canTransition`) and the fee adjustment at confirmation.
- `admin-auth/`: login, password policy and session rules.
- `instance/`: the instance configuration file and its public part.
- `errors/`, `health/`, `money/`: problem details, probe answers, amount formatting.

## Points of attention

- Pure code only: the only npm dependency is `zod`, and nothing is imported from the repository (`pnpm lint:architecture`). A rule that needs the time receives it as a parameter.
- Money is an integer number of ariary.
- Consumers load the compiled `dist/` at run time, while TypeScript reads `src/`. After a change, run `pnpm --filter @entana/contracts build` (or `pnpm build`), otherwise the API and the tests still run the old code.
