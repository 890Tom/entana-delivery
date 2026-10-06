const defaultMaxConnections = 10;
const defaultConnectionTimeoutMs = 5000;
// A wrong or hostile setting must fail at startup, not exhaust the connections of PostgreSQL.
export const maxConnectionsLimit = 50;
const acceptedProtocols: readonly string[] = ["postgres:", "postgresql:"];

export interface DatabaseClientOptions {
  readonly connectionString: string;
  readonly maxConnections?: number;
  readonly connectionTimeoutMs?: number;
}

// Names follow the options of `pg`'s Pool, which is what receives them.
export interface PoolSettings {
  readonly connectionString: string;
  readonly max: number;
  readonly connectionTimeoutMillis: number;
}

// A message holds the option name and a fixed text, never a value the caller supplied: the
// connection string holds the password, so it is never quoted, not even in part, and no `cause`
// is attached because a cause would carry the original message.
export class InvalidDatabaseOptionsError extends Error {
  constructor(option: keyof DatabaseClientOptions, expectation: string) {
    super(`Invalid database option "${option}": ${expectation}.`);
    this.name = "InvalidDatabaseOptionsError";
  }
}

function requirePositiveInteger(option: keyof DatabaseClientOptions, value: number): number {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new InvalidDatabaseOptionsError(option, "expected a positive integer");
  }
  return value;
}

const lastControlOrSpaceCode = 0x20;
const deleteCode = 0x7f;

function hasControlOrSpace(value: string): boolean {
  return Array.from(value).some((character) => {
    const code = character.codePointAt(0) ?? 0;
    return code <= lastControlOrSpaceCode || code === deleteCode;
  });
}

function hasPostgresUrlFormat(value: string): boolean {
  // The string is validated and used as is, with no trimming. The URL parser silently drops
  // leading control characters and tabs or line breaks anywhere, while the pool would receive
  // them: any space or control character is therefore refused (a space in a password must be
  // percent-encoded). The parse error is dropped on purpose: it carries the input.
  if (hasControlOrSpace(value)) {
    return false;
  }
  try {
    return acceptedProtocols.includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

function requireMaxConnections(value: number): number {
  const maxConnections = requirePositiveInteger("maxConnections", value);
  if (maxConnections > maxConnectionsLimit) {
    throw new InvalidDatabaseOptionsError(
      "maxConnections",
      `expected at most ${String(maxConnectionsLimit)}`,
    );
  }
  return maxConnections;
}

export function toPoolSettings(options: DatabaseClientOptions): PoolSettings {
  if (!hasPostgresUrlFormat(options.connectionString)) {
    throw new InvalidDatabaseOptionsError(
      "connectionString",
      "expected a postgres:// or postgresql:// URL without space or control character",
    );
  }
  return {
    connectionString: options.connectionString,
    max: requireMaxConnections(options.maxConnections ?? defaultMaxConnections),
    connectionTimeoutMillis: requirePositiveInteger(
      "connectionTimeoutMs",
      options.connectionTimeoutMs ?? defaultConnectionTimeoutMs,
    ),
  };
}
