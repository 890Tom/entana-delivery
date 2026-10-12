import { ADMIN_PATH } from "./admin-http-limits.js";

function decodeOrKeep(path: string): string {
  try {
    return decodeURIComponent(path);
  } catch {
    return path;
  }
}

/**
 * Whether a request path is under the administration, whatever its spelling: case, doubled or
 * trailing slashes and percent-encoding do not take a route out of the closed area. The router
 * may be stricter than this check (it is what answers 404); this function must never be laxer.
 */
export function isAdminPath(path: string): boolean {
  const canonical = decodeOrKeep(path)
    .toLowerCase()
    .replace(/\/{2,}/g, "/");
  return canonical === ADMIN_PATH || canonical.startsWith(`${ADMIN_PATH}/`);
}
