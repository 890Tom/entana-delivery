import { z } from "zod";

const MIN_ORDER_SEARCH_LENGTH = 2;
const MAX_ORDER_SEARCH_LENGTH = 50;
const MIN_PHONE_SEARCH_DIGITS = 3;

/** What the administration looks for: a name typed on the order, or a part of a phone number. */
export type OrderSearch =
  | { readonly kind: "name"; readonly text: string }
  | { readonly kind: "phone"; readonly digits: string };

// Letters, spaces, hyphens and apostrophes only: no digit, and no `%` or `_` that a LIKE pattern
// would read as a wildcard.
const NAME_CHARACTERS = /^[\p{L}\p{M} '-]+$/u;
const HAS_LETTER = /\p{L}/u;
const PHONE_CHARACTERS = /^[0-9+ .-]+$/;
const NON_DIGITS = /\D/g;

function readSearch(text: string): OrderSearch | null {
  if (HAS_LETTER.test(text) && NAME_CHARACTERS.test(text)) {
    return { kind: "name", text };
  }
  if (!PHONE_CHARACTERS.test(text)) {
    return null;
  }
  // The national zero is not in a stored E.164 number ("034..." is "+26134...").
  const digits = text.replace(NON_DIGITS, "").replace(/^0/, "");
  return digits.length >= MIN_PHONE_SEARCH_DIGITS ? { kind: "phone", digits } : null;
}

export const orderSearchSchema = z
  .string()
  .trim()
  .min(MIN_ORDER_SEARCH_LENGTH)
  .max(MAX_ORDER_SEARCH_LENGTH)
  .transform((text, context): OrderSearch => {
    const search = readSearch(text);
    if (search === null) {
      context.issues.push({ code: "custom", message: "invalid search", input: text });
      return z.NEVER;
    }
    return search;
  });
