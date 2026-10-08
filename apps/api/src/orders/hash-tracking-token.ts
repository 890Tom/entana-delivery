import { createHash } from "node:crypto";

/**
 * The SHA-256 of a tracking token as 64 lowercase hex characters: the only form in which the token
 * reaches the database. The token is 32 random bytes, so a plain hash is enough (no salt, no
 * slow hash): there is nothing to guess.
 */
export function hashTrackingToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}
