/** `instance` when the path cannot be shown as it is. */
export const FALLBACK_INSTANCE = "about:blank";

const MAX_INSTANCE_LENGTH = 200;
// URL path characters only: a character outside this set (a control character, a space, a
// non-ASCII character) or a malformed percent sequence could be used to forge a log line or a
// display, so the whole path is replaced rather than cleaned.
const SAFE_PATH = /^\/(?!\/)(?:[A-Za-z0-9/\-_.~]|%[0-9A-Fa-f]{2})*$/;
const PARTIAL_PERCENT_SEQUENCE_AT_END = /%[0-9A-Fa-f]?$/;

// The raw path is shown because no route carries a secret in its path: the tracking token travels
// in a header (X-Tracking-Token). A route that ever puts a secret in its path must make `instance`
// come from its route template instead.

/**
 * The `instance` of a problem: the path of the request URL. The rule: cut at the first "?" or
 * "#" (a query string or a fragment is never shown), keep at most 200 characters before any
 * decoding (never ending inside a "%XX" sequence), and copy the result only if it is made of URL
 * path characters and starts with a single "/" (a "//" start would read as another host);
 * otherwise "about:blank". Percent sequences stay encoded: a consumer must not decode the value.
 */
export function toProblemInstance(originalUrl: string): string {
  const [path = ""] = originalUrl.split(/[?#]/, 1);
  const isTruncated = path.length > MAX_INSTANCE_LENGTH;
  const kept = isTruncated
    ? path.slice(0, MAX_INSTANCE_LENGTH).replace(PARTIAL_PERCENT_SEQUENCE_AT_END, "")
    : path;
  return SAFE_PATH.test(kept) ? kept : FALLBACK_INSTANCE;
}
