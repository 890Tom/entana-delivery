// This suite creates and drops a database, and runs the migrations: it must never reach a server
// that is not the developer's own by accident (a production URL left in the shell or in .env).
const LOOPBACK_HOSTS: ReadonlySet<string> = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);
// The pg driver lets these query parameters replace the host of the URL: they are checked too.
const HOST_OVERRIDING_PARAMETERS = ["host", "hostaddr"] as const;

export type DatabaseHostKind = "local" | "remote" | "invalid";

/** Looks at the host the driver will really connect to. It never returns, or echoes, any part of the URL. */
export function classifyDatabaseHost(databaseUrl: string): DatabaseHostKind {
  let url: URL;
  try {
    url = new URL(databaseUrl);
  } catch {
    // The parse error is dropped on purpose: it carries the input.
    return "invalid";
  }
  const hosts = [
    url.hostname,
    ...HOST_OVERRIDING_PARAMETERS.flatMap((name) => url.searchParams.getAll(name)),
  ];
  return hosts.every((host) => LOOPBACK_HOSTS.has(host)) ? "local" : "remote";
}
