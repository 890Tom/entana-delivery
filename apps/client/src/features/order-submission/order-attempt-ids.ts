const TOKEN_BYTES = 32;
const UUID_BYTES = 16;

export type RandomBytes = (count: number) => Uint8Array;

/** `getRandomValues` exists in every context, unlike `randomUUID` (secure contexts only). */
const browserRandomBytes: RandomBytes = (count) => {
  return crypto.getRandomValues(new Uint8Array(count));
};

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** 32 random bytes in base64url without padding: the 43 characters the contract expects. */
export function generateTrackingToken(randomBytes: RandomBytes): string {
  return toBase64Url(randomBytes(TOKEN_BYTES));
}

/** A lowercase version 4 uuid: 16 random bytes, with the version and variant bits set. */
export function generateIdempotencyKey(randomBytes: RandomBytes): string {
  const bytes = randomBytes(UUID_BYTES);
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join("-");
}

export interface AttemptIds {
  readonly key: string;
  readonly token: string;
}

/** Made together, once per attempt. Null when the browser has no random source. */
export function createAttemptIds(randomBytes: RandomBytes = browserRandomBytes): AttemptIds | null {
  try {
    return {
      key: generateIdempotencyKey(randomBytes),
      token: generateTrackingToken(randomBytes),
    };
  } catch {
    return null;
  }
}
