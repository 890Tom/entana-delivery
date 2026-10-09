# 0014. Database error handling

- Status: accepted
- Date: 2026-10-06

## Context

The errors that Prisma and `pg` raise can contain table, constraint and column names, SQL, host names and the values of a query. A client must never receive them, and the logs must not hold them ([engineering standards](../engineering-standards.md) §10: no secret in logs, no personal data in logs). Database access itself is described in [ADR 0013](0013-database-access-and-health-endpoints.md); the database code has one owner ([ADR 0005](0005-dedicated-database-package.md)). This record covers what the API does when a database call fails.

## Decision

### Classification, in `packages/database`

`classifyDatabaseError(error)` (`src/classify-database-error.ts`) turns any thrown value into one member of `DATABASE_ERROR_KINDS`: `unique_violation`, `foreign_key_violation`, `check_violation`, `not_null_violation`, `record_not_found`, `connection`, `timeout`, `unknown`.

- It is a pure function and never throws (the body is inside `try`/`catch` and falls back to `unknown`). It returns only a kind: no message, stack or name is returned, copied or logged.
- The distinguishing property of each kind, as observed with Prisma 7.10.0, `@prisma/adapter-pg` 7.10.0 and `pg` 8.23.1 (the header comment of the file):

  | Kind                    | Observed discriminator                                                         |
  | ----------------------- | ------------------------------------------------------------------------------ |
  | `unique_violation`      | Prisma code `P2002`; driver `originalCode` `23505`                             |
  | `foreign_key_violation` | Prisma code `P2003`; driver `originalCode` `23503`                             |
  | `check_violation`       | Prisma code `P2039`; driver `originalCode` `23514`                             |
  | `not_null_violation`    | Prisma code `P2010` (raw SQL); driver `originalCode` `23502`                   |
  | `record_not_found`      | Prisma code `P2025`, no driver error                                           |
  | `connection`            | Prisma code `P2010` (raw SQL); driver kind `DatabaseNotReachable`              |
  | `timeout`               | plain `Error` with no code and no `meta`: only its text (see the next section) |

  `P2010` and `P2039` are generic: they are classified through the driver error, never alone. The driver error sits in `meta.driverAdapterError.cause`, not in `cause`.

- Properties are read by duck typing, never with `instanceof`: class identity breaks if a package is loaded twice (comment in the file).
- The error is searched along its `cause` chain: the error itself, then at most `MAX_CAUSE_DEPTH = 5` causes, with protection against a cycle. The chain is collected from the outermost error inwards and the first node with a kind wins. In a node, the driver error is read before the Prisma code.
- Every lookup is an allow-list (a `Map` of known codes, SQLSTATEs and driver kinds), and a value that is not a string is ignored.

### The one exception to "never match on error messages"

A connection that times out against a server that accepts and never answers raises a plain `Error` with no code and no structural marker. `isPoolConnectTimeout` recognises it by comparing its message with the literal `POOL_CONNECT_TIMEOUT_TEXT` (`"Connection terminated due to connection timeout"`, observed with `pg` 8.23.1, pg-pool 3.14.0 and Prisma 7.10.0). This is the exception written in standards §6.

- It is one isolated function, tried after every structural check on every node of the chain.
- It requires an `Error` whose `code` is not a string, and a message strictly equal to the literal. The message is never copied or returned.
- An integration test against a real server that never answers pins it (`classify-database-error.integration.test.ts`). An upgrade of `pg` that changes the text turns that test red.
- If the text stops matching, the error is classified `unknown`, which is answered as a generic 500.

### Mapping, in `apps/api`

`DATABASE_FAILURE_RESPONSES` (`src/errors/database-failure/database-failure-mapping.ts`) has one entry per kind and is declared `satisfies Record<DatabaseErrorKind, …>`: a new kind in `@entana/database` breaks the build until it is mapped. Each answer is a fixed status, a fixed `detail` and a log level, so the body is the same for every cause of a given status.

| Kind                                               | Status | `detail`                                                     | Log level |
| -------------------------------------------------- | ------ | ------------------------------------------------------------ | --------- |
| `connection`, `timeout`                            | 503    | The service is temporarily unavailable.                      | warn      |
| `unique_violation`, `foreign_key_violation`        | 409    | The request conflicts with the current state of the service. | info      |
| `record_not_found`                                 | 404    | The requested resource was not found.                        | info      |
| `check_violation`, `not_null_violation`, `unknown` | 500    | An unexpected error occurred.                                | error     |

The reasoning for the 500 on a CHECK or NOT NULL violation is that these rules are enforced by the database after the shared schemas validated the input, so a violation points to a defect in our code, not to a client error. That reasoning is not recorded elsewhere.

### Logging

`sendProblem` (`src/errors/problem-details/send-problem.ts`) writes one line per failed request for a classified database failure: the fixed message `Database operation failed.` and a `reason` equal to the kind. The level comes from the mapping. The error object is never logged. `unknown` is not logged this way: the generic 500 path logs the error type and stack frames, as for any unexpected error.

### The leak suite, in `apps/api/tests/integration`

The suite starts the real application module on a temporary schema of a real PostgreSQL, with test-only routes that run one real failing operation per case (unique, foreign key, check, not null, missing record), plus a baseline route that throws a non-database error. For each case it checks:

- the status, the content type and the whole body against a literal;
- the headers, the body, the access log line, the failure log line and everything written to the console, scanned for forbidden strings;
- exactly one failure log line and one access line, and that the failure line equals `{ level, reason, msg }` (plus the logger's `context` and a request binding with only `id` and `method`).

The forbidden strings are derived at run time from the schema (`forbidden-strings.ts`): table and column names of at least `MINIMUM_NAME_LENGTH = 6` characters, constraint and index names, the schema name, the inserted values and UUIDs, the password raw and URL-encoded, the connection string, the words `violates`, `duplicate key`, `constraint` and `sqlstate`, the broad words `prisma`, `postgres`, `insert` and `select`, and the driver codes (`P2002`, `P2003`, `P2010`, `P2025`, `23505`, `23503`, `23514`, `23502`). Broad names are looked for in parsed values only, the high-signal strings in the raw text, and the codes as whole tokens.

A baseline exempts the broad names that a non-database 5xx answer already contains, only in the output where they were seen. The suite prints the list at each run, in its baseline section; at the time of writing it is `action` in the headers and `status` in the access log. It depends on the framework plumbing and may change with its versions.

The suite proves it can fail: a positive control feeds the raw error of each real operation to the matcher, which must flag it; matcher tests cover each kind of forbidden string, an exemption that does not apply in another output, and a name that is only a key. The suite refuses to create or drop a schema when the host of `DATABASE_URL` is not `localhost`, `127.0.0.1` or `[::1]`, unless `ENTANA_ALLOW_REMOTE_TEST_DB=1` is set.

## Consequences

- A database failure reaches a client or a log only as a fixed status, a fixed sentence and a kind, within the limits below.
- There is one place to change a mapping, and the build fails on an unmapped kind.
- One test depends on the text of a driver message, and the classifier has to be re-observed when Prisma, the adapter or `pg` is upgraded (the header comment says so).
- Part of the schema setup is duplicated between the two integration suites, and the API suite reads the migration files of another package (known debt, see ADR 0013).

Limits of the suite, each from the matcher:

- A value that is transformed before it is written (hashed, re-encoded, reformatted) is not detected: only the raw and URL-encoded password, and case-insensitive substrings of the other strings, are looked for.
- Names shorter than `MINIMUM_NAME_LENGTH` are not looked for, and a broad name that only appears as a key is not checked in values. The suite reports the latter at each run; at the time of writing it is `status`.
- Only the headers, the body, the two log lines and the console are captured. Other channels are not covered.
- This suite does not exercise the connection and timeout paths (503); the classifier integration test and `tests/e2e/database-failures.e2e.test.ts` do.
- The suite has no explicit check for open handles (none was found in the test files).

## Alternatives considered

- **Matching on error messages everywhere.** Not chosen: standards §6 says never to match on messages, and a message can hold names, SQL and values. The one exception is limited to the pool timeout, which has nothing else to match on.
- **`instanceof` checks on the Prisma error classes.** Not chosen: class identity breaks if a package is loaded twice (comment in the classifier), so properties are read by duck typing.

## Note, 2026-10-07

The API integration suite described above ran on a temporary schema selected with `search_path`. That isolation covered raw SQL only: the Prisma model API qualifies tables with `public`, so model calls (`client.customer.create`, and so on) reached the configured database. The suite now creates one throwaway database per run (`test_` and lowercase hex), applies the migrations in it, drops it at the end and fails if the configured database changed; this replaced the schema. The text above is left as it was written.

The classifier integration test in `packages/database` had the same weakness: it ran on a temporary schema, and its Prisma model calls wrote to `public` of the configured database. That suite now also runs in a throwaway database per run, with the same row-count proof (2026-10-07).

## Note, 2026-10-07 (connection failures through a host name)

The classifier now also gives `connection` to these shapes, observed with Prisma 7.10.0, `@prisma/adapter-pg` 7.10.0, `pg` 8.23.1 and Node 24.21.0:

- a string `code` of `ECONNREFUSED` on the error itself;
- Prisma code `P1017` (model query) or `P2010` (raw query), each together with driver kind `ConnectionClosed`: a server that accepts the connection and closes it. Only these two pairs were observed, and the pair rule is a deliberate allow-list: the kind alone is not accepted, and a pair is added only after a new observation;
- a string `code` of `EPIPE` on the error itself, seen once in 200 runs of the same accept-then-reset case;
- driver `originalCode` `57P01` (the server shut down during a query); it counts under any Prisma code, like the `23xxx` SQLSTATEs.

A deployed application connects through a host name, which can resolve to several addresses; there, a refused connection does not have the shape of an IP-literal host (`P1001`, `DatabaseNotReachable`) and was answered as a 500. A host name that does not resolve (`.invalid`) already gives `P1001` and needed no change. The decision text above is left as it was written.

- `EPIPE` cannot be provoked on demand, so it is covered by a unit test built from the observed shape and not by a real-error integration test. This is a deliberate departure from one real-error integration test per shape.
- Known limitation: a plain close of the connection (not a reset) sometimes (about 1 in 12) gives a `pg` error with no code and no structural property, only its text. It is not matched and stays `unknown` (a 500). Trigger to revisit: `reason: unknown` seen in the logs during a real database restart.
- Classification is by shape: a `connection` kind does not say which dependency failed (the database, a proxy, the network or a name server).
- A 503 received during a write does not say whether the write was applied.
