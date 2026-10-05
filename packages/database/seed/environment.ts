// Node does not read .env files: the root .env is loaded here, as in prisma.config.ts.
// A missing file is fine, and variables already set in the shell win over the file.
export function loadRootEnvFile(): void {
  try {
    process.loadEnvFile(new URL("../../../.env", import.meta.url));
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) {
      throw error;
    }
  }
}

// Host and port only: the connection string holds the password and must never be printed.
// A string that does not parse (a password with an unescaped "/" or "#", for example) gives a
// fixed text, and the error is not rethrown: its message could quote the whole string.
export function describeDatabaseTarget(databaseUrl: string): string {
  try {
    const { hostname, port } = new URL(databaseUrl);
    if (hostname === "") return "the configured database";
    return port === "" ? hostname : `${hostname}:${port}`;
  } catch {
    return "the configured database";
  }
}
