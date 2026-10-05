// Hosts where wiping the database is acceptable: this machine, and the Docker Compose service
// of docker-compose.yml. Anything else is refused.
const LOCAL_DATABASE_HOSTS: readonly string[] = ["localhost", "127.0.0.1", "[::1]", "postgres"];

// Fails closed: a value that cannot be understood is not local.
export function isLocalDatabaseHost(databaseUrl: string): boolean {
  let url: URL;
  try {
    url = new URL(databaseUrl);
  } catch {
    return false;
  }
  // node-postgres lets these query parameters override the host of the URL.
  if (url.searchParams.has("host") || url.searchParams.has("hostaddr")) return false;
  // An empty host means a Unix socket or the PGHOST variable: not checkable here.
  if (url.hostname === "") return false;
  // The exact name is compared, so "localhost.example.com" and "localhost." are not local.
  return LOCAL_DATABASE_HOSTS.includes(url.hostname.toLowerCase());
}

export interface DestructiveSeedEnvironment {
  readonly NODE_ENV?: string | undefined;
  readonly ALLOW_DESTRUCTIVE_SEED?: string | undefined;
  readonly ALLOW_SEED_NON_LOCAL?: string | undefined;
  readonly DATABASE_URL?: string | undefined;
}

// Opt-in flags that must be given on the command line. A leftover line in .env would arm them
// for every later run, so a flag that only the .env file defines is refused.
const OPT_IN_FLAGS = ["ALLOW_DESTRUCTIVE_SEED", "ALLOW_SEED_NON_LOCAL"] as const;

// `shell` is the environment before the .env file is loaded, `loaded` the one after.
export function optInFlagsDefinedByEnvFile(
  shell: Readonly<Record<string, string | undefined>>,
  loaded: Readonly<Record<string, string | undefined>>,
): string[] {
  return OPT_IN_FLAGS.filter((flag) => shell[flag] === undefined && loaded[flag] !== undefined);
}

// Reasons to refuse the plain seed. It is not destructive, but it creates an admin account and
// orders whose tracking tokens are public: never in production, and on a remote database only
// with an explicit opt-in.
export function seedRefusals(environment: DestructiveSeedEnvironment): string[] {
  const refusals: string[] = [];
  if (environment.NODE_ENV === "production") {
    refusals.push("NODE_ENV is production: demo data must never be created there.");
  }
  const isLocal =
    environment.DATABASE_URL !== undefined && isLocalDatabaseHost(environment.DATABASE_URL);
  if (!isLocal && environment.ALLOW_SEED_NON_LOCAL !== "true") {
    refusals.push(
      "The database host is not local (localhost, 127.0.0.1, [::1] or the compose service " +
        "postgres). To seed another database on purpose, set ALLOW_SEED_NON_LOCAL=true.",
    );
  }
  return refusals;
}

// Every reason to refuse, empty when the reset may go ahead.
export function destructiveSeedRefusals(environment: DestructiveSeedEnvironment): string[] {
  const refusals: string[] = [];
  if (environment.NODE_ENV === "production") {
    refusals.push("NODE_ENV is production.");
  }
  if (environment.ALLOW_DESTRUCTIVE_SEED !== "true") {
    refusals.push('ALLOW_DESTRUCTIVE_SEED is not set to "true".');
  }
  if (environment.DATABASE_URL === undefined || !isLocalDatabaseHost(environment.DATABASE_URL)) {
    refusals.push(
      "The database host is not local (localhost, 127.0.0.1, [::1] or the compose service postgres).",
    );
  }
  return refusals;
}
