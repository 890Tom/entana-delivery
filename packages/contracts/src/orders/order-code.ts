import { z } from "zod";

/**
 * The 24 letters A-Z without I and O, then the digits 2 to 9: 32 characters. No 0, O, 1 or I,
 * which look alike when read aloud or copied by hand. 32 divides 256, so `byte & 31` has no bias.
 */
export const ORDER_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const ORDER_CODE_LENGTH = 6;

const INDEX_MASK = ORDER_CODE_ALPHABET.length - 1;

/**
 * Builds a 6-character order code from an injected random source: `randomBytes(n)` must return
 * n unpredictable bytes (the API passes a secure source; this package has none).
 * Byte 0 gives "A", byte 23 "Z", byte 24 "2" and byte 31 "9"; the high 3 bits are dropped.
 *
 * An order code is NOT a secret: 32^6 values are guessable by a determined attacker. It is
 * always used together with the customer's phone number, and lookups will be rate limited.
 * Uniqueness is the database's job (unique column), not this function's.
 *
 * @throws RangeError when the source does not return exactly `ORDER_CODE_LENGTH` bytes.
 */
export const generateOrderCode = (randomBytes: (count: number) => Uint8Array): string => {
  const bytes = randomBytes(ORDER_CODE_LENGTH);
  if (bytes.length !== ORDER_CODE_LENGTH) {
    throw new RangeError(`the random source must return ${String(ORDER_CODE_LENGTH)} bytes`);
  }
  return Array.from(bytes, (byte) => ORDER_CODE_ALPHABET.charAt(byte & INDEX_MASK)).join("");
};

const isMadeOfAlphabet = (value: string): boolean => {
  for (let index = 0; index < value.length; index += 1) {
    if (!ORDER_CODE_ALPHABET.includes(value.charAt(index))) {
      return false;
    }
  }
  return true;
};

/**
 * Exactly 6 characters of `ORDER_CODE_ALPHABET`. Uppercase only: the schema does not transform,
 * so a client that accepts lowercase input uppercases it before sending.
 * An order code is NOT a secret (see `generateOrderCode`).
 */
export const orderCodeSchema = z
  .string()
  .length(ORDER_CODE_LENGTH, { abort: true })
  .refine(isMadeOfAlphabet, "must only use the characters of the order code alphabet");

export type OrderCode = z.infer<typeof orderCodeSchema>;
