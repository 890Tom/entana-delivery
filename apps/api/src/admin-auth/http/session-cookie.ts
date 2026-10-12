const SESSION_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const SECURE_PREFIX = "__Host-";
const BASE_NAME = "admin_session";

/** Where the session cookie settings live for the whole application. */
export interface SessionCookieSettings {
  readonly name: string;
  readonly isSecure: boolean;
}

/**
 * The `__Host-` prefix makes a browser refuse the cookie unless it is Secure, has Path=/ and has
 * no Domain: another subdomain cannot set it. It needs HTTPS, so it goes with `Secure` only.
 */
export function sessionCookieSettings(isSecure: boolean): SessionCookieSettings {
  return { name: isSecure ? `${SECURE_PREFIX}${BASE_NAME}` : BASE_NAME, isSecure };
}

function attributes(settings: SessionCookieSettings, maxAgeSeconds: number): string {
  const parts = ["Path=/", `Max-Age=${String(maxAgeSeconds)}`, "HttpOnly", "SameSite=Strict"];
  if (settings.isSecure) {
    parts.push("Secure");
  }
  return parts.join("; ");
}

/** The Set-Cookie value of a new session. The token is base64url: it needs no encoding. */
export function serializeSessionCookie(
  settings: SessionCookieSettings,
  token: string,
  maxAgeSeconds: number,
): string {
  return `${settings.name}=${token}; ${attributes(settings, maxAgeSeconds)}`;
}

/** The Set-Cookie value that makes the browser forget the cookie, with the same attributes. */
export function serializeClearedSessionCookie(settings: SessionCookieSettings): string {
  return `${settings.name}=; ${attributes(settings, 0)}`;
}

/** The session token sent by the browser, or undefined if there is none or it cannot be one. */
export function readSessionToken(
  cookieHeader: string | undefined,
  settings: SessionCookieSettings,
): string | undefined {
  const value = readCookieValue(cookieHeader, settings.name);
  return value !== undefined && SESSION_TOKEN_PATTERN.test(value) ? value : undefined;
}

/** Whether the request carries a cookie of that name, whatever its value. */
export function hasSessionCookie(
  cookieHeader: string | undefined,
  settings: SessionCookieSettings,
): boolean {
  return readCookieValue(cookieHeader, settings.name) !== undefined;
}

// The first cookie of that name wins. Values are not decoded: a token never needs it.
function readCookieValue(header: string | undefined, name: string): string | undefined {
  if (header === undefined) {
    return undefined;
  }
  for (const pair of header.split(";")) {
    const separator = pair.indexOf("=");
    if (separator !== -1 && pair.slice(0, separator).trim() === name) {
      return pair.slice(separator + 1).trim();
    }
  }
  return undefined;
}
