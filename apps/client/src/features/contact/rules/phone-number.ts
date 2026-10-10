import { normalizePhone } from "@entana/contracts";

/** The longest text the phone field takes: a national number with a few separators. */
export const MAX_PHONE_INPUT_LENGTH = 20;

// What the customer may type. The "+" is not one: the country code is shown, not typed.
const TYPED_PHONE_PATTERN = /^[0-9 .()-]*$/;

/**
 * The international number of what was typed after the country code: digits only, one leading
 * zero removed (it is the national trunk prefix, which the displayed code replaces). Whether it
 * is a number is for `normalizePhone` to say, the same function as the server's.
 */
export function composePhoneNumber(typed: string, countryCode: string): string {
  const digits = typed.replace(/\D/g, "");
  return `+${countryCode}${digits.startsWith("0") ? digits.slice(1) : digits}`;
}

export function isValidPhone(typed: string, countryCode: string): boolean {
  return (
    typed.length <= MAX_PHONE_INPUT_LENGTH &&
    TYPED_PHONE_PATTERN.test(typed) &&
    normalizePhone(composePhoneNumber(typed, countryCode), countryCode) !== null
  );
}

/** Whether a stored text could have been typed in the phone field. */
export function isTypablePhone(text: string): boolean {
  return text.length <= MAX_PHONE_INPUT_LENGTH && TYPED_PHONE_PATTERN.test(text);
}
