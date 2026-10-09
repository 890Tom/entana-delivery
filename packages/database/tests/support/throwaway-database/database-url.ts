// Prisma 7 and Node do not read .env files: the root .env is loaded here, as in prisma.config.ts.
// A missing file is fine: in CI the variables come from the environment.
function loadRootEnvFile(): void {
  try {
    process.loadEnvFile(new URL("../../../../../.env", import.meta.url));
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) {
      throw error;
    }
  }
}

export function requireDatabaseUrl(): string {
  loadRootEnvFile();
  const databaseUrl = process.env.DATABASE_URL;
  if (databaseUrl === undefined || databaseUrl === "") {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env and start PostgreSQL with `pnpm db:up`.",
    );
  }
  return databaseUrl;
}

// Host and port only: the connection string holds the password and must never be printed.
export function describeDatabaseTarget(databaseUrl: string): string {
  const { hostname, port } = new URL(databaseUrl);
  return `${hostname}:${port}`;
}
