export type HostVerdict = "allowed" | "refused";

const POSTGRES_PROTOCOLS: ReadonlySet<string> = new Set(["postgres:", "postgresql:"]);
// Dotted quad only, with the first octet 127. URL leaves decimal, hexadecimal, octal and
// shortened forms (2130706433, 0x7f000001, 0177.0.0.1, 127.1) untouched for this scheme, and
// none of them match.
const LOOPBACK_IPV4 =
  /^127\.(?:25[0-5]|2[0-4]\d|1?\d?\d)\.(?:25[0-5]|2[0-4]\d|1?\d?\d)\.(?:25[0-5]|2[0-4]\d|1?\d?\d)$/;

// An allow-list, and pure: it runs before any connection or DNS lookup, and it fails closed.
// It reads the host the way node-postgres does: the host of the URL, unless a `host` or
// `hostaddr` parameter overrides it.
export function checkTestDatabaseHost(databaseUrl: string): HostVerdict {
  let url: URL;
  try {
    url = new URL(databaseUrl);
  } catch {
    return "refused";
  }
  if (!POSTGRES_PROTOCOLS.has(url.protocol)) return "refused";
  if (url.searchParams.has("host") || url.searchParams.has("hostaddr")) return "refused";
  // Case-insensitive, but the exact name: "localhost." and "localhost.invalid" do not match.
  const hostname = url.hostname.toLowerCase();
  if (hostname === "localhost" || hostname === "[::1]") return "allowed";
  return LOOPBACK_IPV4.test(hostname) ? "allowed" : "refused";
}

// Exactly "1": "true", "yes" and an empty value must not lift a safety check by accident.
export function isRemoteOverrideEnabled(value: string | undefined): boolean {
  return value === "1";
}
