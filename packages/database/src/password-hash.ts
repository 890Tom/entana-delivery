import { argon2, randomBytes, timingSafeEqual } from "node:crypto";
import type { Argon2Parameters } from "node:crypto";

// Argon2id with the first minimum configuration of the OWASP Password Storage Cheat Sheet
// (m=19456, t=2, p=1). See ADR 0008. Node's built-in implementation needs Node >= 24.7.
export const ARGON2ID_PARAMETERS = {
  memoryKib: 19_456,
  passes: 2,
  parallelism: 1,
  saltLength: 16,
  tagLength: 32,
} as const;

// Limits on the parameters read from a stored hash, so that a corrupted or tampered row cannot
// make a login allocate gigabytes or run for minutes. They are far above what we write.
const STORED_LIMITS = {
  maxMemoryKib: 1_048_576,
  maxPasses: 10,
  maxParallelism: 16,
  minSaltBytes: 8,
  minTagBytes: 16,
} as const;

// PHC string format: $argon2id$v=19$m=<memory>,t=<passes>,p=<parallelism>$<salt>$<hash>
// Salt and hash are base64 without padding. The parameters travel with the hash, so they can be
// raised later without invalidating the hashes already stored.
const PHC_PATTERN =
  /^\$argon2id\$v=19\$m=(\d+),t=(\d+),p=(\d+)\$([A-Za-z0-9+/]+)\$([A-Za-z0-9+/]+)$/;

function deriveKey(parameters: Argon2Parameters): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    argon2("argon2id", parameters, (error, key) => {
      if (error === null) {
        resolve(key);
      } else {
        reject(error);
      }
    });
  });
}

function encodeBase64WithoutPadding(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64").replace(/=+$/, "");
}

function isWithinStoredLimits(parameters: {
  memory: number;
  passes: number;
  parallelism: number;
}): boolean {
  const { memory, passes, parallelism } = parameters;
  return (
    [memory, passes, parallelism].every((value) => Number.isSafeInteger(value) && value >= 1) &&
    memory <= STORED_LIMITS.maxMemoryKib &&
    passes <= STORED_LIMITS.maxPasses &&
    parallelism <= STORED_LIMITS.maxParallelism &&
    // Argon2 needs at least 8 KiB of memory per lane.
    memory >= 8 * parallelism
  );
}

export async function hashPassword(password: string): Promise<string> {
  if (password === "") {
    throw new RangeError("The password must not be empty.");
  }
  const { memoryKib, passes, parallelism, saltLength, tagLength } = ARGON2ID_PARAMETERS;
  const salt = randomBytes(saltLength);
  const hash = await deriveKey({
    message: password,
    nonce: salt,
    memory: memoryKib,
    passes,
    parallelism,
    tagLength,
  });
  const parameters = `m=${String(memoryKib)},t=${String(passes)},p=${String(parallelism)}`;
  return `$argon2id$v=19$${parameters}$${encodeBase64WithoutPadding(salt)}$${encodeBase64WithoutPadding(hash)}`;
}

interface StoredHash {
  readonly argon2: { memory: number; passes: number; parallelism: number };
  readonly salt: Buffer;
  readonly expected: Buffer;
}

// Reads a PHC string and applies the limits on what it declares. Null when it is not one we
// would have written.
function parseStoredHash(storedHash: string): StoredHash | null {
  const match = PHC_PATTERN.exec(storedHash);
  const [, memory, passes, parallelism, salt, hash] = match ?? [];
  if (
    memory === undefined ||
    passes === undefined ||
    parallelism === undefined ||
    salt === undefined ||
    hash === undefined
  ) {
    return null;
  }
  const argon2Parameters = {
    memory: Number(memory),
    passes: Number(passes),
    parallelism: Number(parallelism),
  };
  const saltBytes = Buffer.from(salt, "base64");
  const expected = Buffer.from(hash, "base64");
  const isTooWeak =
    saltBytes.length < STORED_LIMITS.minSaltBytes || expected.length < STORED_LIMITS.minTagBytes;
  if (!isWithinStoredLimits(argon2Parameters) || isTooWeak) return null;
  return { argon2: argon2Parameters, salt: saltBytes, expected };
}

// Returns false (never throws) for a wrong password and for a stored value that is not a
// valid Argon2id hash, so a login handler treats both the same way.
export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const stored = parseStoredHash(storedHash);
  if (stored === null || password === "") return false;
  try {
    const actual = await deriveKey({
      message: password,
      nonce: stored.salt,
      ...stored.argon2,
      tagLength: stored.expected.length,
    });
    return actual.length === stored.expected.length && timingSafeEqual(actual, stored.expected);
  } catch {
    // Parameters outside what Argon2 accepts (for example a salt that is too short).
    return false;
  }
}
