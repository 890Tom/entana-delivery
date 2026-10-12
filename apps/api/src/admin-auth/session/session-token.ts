import { createHash, randomBytes } from "node:crypto";

const TOKEN_BYTES = 32;

/** A session token: 32 random bytes from the CSPRNG, as 43 base64url characters. */
export function generateSessionToken(): string {
  return randomBytes(TOKEN_BYTES).toString("base64url");
}

/**
 * The SHA-256 of a token as 64 lowercase hex characters: the only form in which it reaches the
 * database. The token has 256 bits of entropy, so a plain hash is enough (no salt, no slow hash).
 */
export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}
