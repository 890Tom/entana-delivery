const MAX_INPUT_LENGTH = 32;
const MIN_DIGITS = 7;
const MAX_DIGITS = 15;

interface ScannedPhone {
  readonly digits: string;
  readonly hasPlus: boolean;
  // True when the character right after the first digit is a digit too.
  readonly isFirstDigitGlued: boolean;
}

const isAsciiDigit = (character: string): boolean => character >= "0" && character <= "9";

const isSeparator = (character: string): boolean => " ().-".includes(character);

// A country calling code is 1 to 3 digits and never starts with 0. The pattern is anchored, has no
// nested quantifier and only ever sees the developer's constant, not user input.
const COUNTRY_CODE_PATTERN = /^[1-9][0-9]{0,2}$/;

// One linear pass. Only ASCII digits, one leading "+" and the separators are allowed: any other
// character (letters, fullwidth or Arabic-Indic digits, zero-width or non-breaking spaces) fails.
const scanPhone = (input: string): ScannedPhone | null => {
  const hasPlus = input.startsWith("+");
  let digits = "";
  let isFirstDigitGlued = false;
  for (let index = hasPlus ? 1 : 0; index < input.length; index += 1) {
    const character = input.charAt(index);
    if (isAsciiDigit(character)) {
      if (digits === "") {
        isFirstDigitGlued = isAsciiDigit(input.charAt(index + 1));
      }
      digits += character;
    } else if (!isSeparator(character)) {
      return null;
    }
  }
  return { digits, hasPlus, isFirstDigitGlued };
};

// Returns the digits of the E.164 number (country code included) or null.
const resolveInternationalDigits = (scanned: ScannedPhone, countryCode: string): string | null => {
  const { digits, hasPlus, isFirstDigitGlued } = scanned;
  if (hasPlus) {
    return digits;
  }
  if (!digits.startsWith("0") || !isFirstDigitGlued) {
    // Either no trunk prefix at all, or "0 34 ...": ambiguous, never guessed.
    return null;
  }
  // "00" is the international call prefix; a single "0" is the national trunk prefix.
  return digits.charAt(1) === "0" ? digits.slice(2) : `${countryCode}${digits.slice(1)}`;
};

// A trunk zero kept after the default country code ("+261 034 ...") is refused instead of removed:
// a silent correction could attach an order to the wrong customer.
const hasTrunkZeroAfterCountryCode = (digits: string, countryCode: string): boolean => {
  return digits.startsWith(countryCode) && digits.charAt(countryCode.length) === "0";
};

/**
 * Turns what a customer typed into an E.164 number ("+261341234567"), or null. Total: it never
 * throws. `defaultCountryCode` is the country calling code without "+" ("261"), used for the
 * national form that starts with a trunk zero. The output always matches the database CHECK
 * `^\+[1-9][0-9]{6,14}$`. The input is only scanned once and its length is checked first.
 *
 * Refused rather than guessed: a "+" that is not first, a space-separated trunk zero ("0 34 ..."),
 * a trunk zero after the default country code ("+261 034 ..."), and any non-ASCII character. A
 * trunk zero after another country's code cannot be detected without a table of countries.
 */
export const normalizePhone = (input: string, defaultCountryCode: string): string | null => {
  if (input.length > MAX_INPUT_LENGTH || !COUNTRY_CODE_PATTERN.test(defaultCountryCode)) {
    return null;
  }
  const scanned = scanPhone(input);
  if (scanned === null) {
    return null;
  }
  const digits = resolveInternationalDigits(scanned, defaultCountryCode);
  if (digits === null || hasTrunkZeroAfterCountryCode(digits, defaultCountryCode)) {
    return null;
  }
  const isLengthValid = digits.length >= MIN_DIGITS && digits.length <= MAX_DIGITS;
  return isLengthValid && !digits.startsWith("0") ? `+${digits}` : null;
};
