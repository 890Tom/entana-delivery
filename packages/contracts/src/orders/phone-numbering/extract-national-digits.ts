import { findNumberingRule } from "./numbering-plan.js";

// What is read of a field: more than this is never looked at, whatever a paste brings.
const MAX_RAW_LENGTH = 64;
// The longest E.164 number, country code included (what the database and normalizePhone say).
const MAX_E164_DIGITS = 15;

const withoutCountryPrefix = (text: string, countryCode: string): string => {
  for (const prefix of [`+${countryCode}`, `00${countryCode}`]) {
    if (text.startsWith(prefix)) {
      return text.slice(prefix.length);
    }
  }
  return text;
};

/**
 * The national digits of what was typed, pasted or filled in a phone field: at most 64
 * characters are read; a start of "+" and the country code, or "00" and the country code, is
 * removed; the digits are kept; for a country that declares a trunk prefix, one is removed (it is
 * replaced by the country code shown); and the digits past the longest number are dropped. The
 * country code without "+" or "00" is not recognised: it is read as digits, and the number is
 * then refused. Pure and total. The result is a display aid: `parsePhoneNumber` decides.
 */
export const extractNationalDigits = (raw: string, countryCode: string): string => {
  const read = raw.slice(0, MAX_RAW_LENGTH).trimStart();
  const digits = withoutCountryPrefix(read, countryCode).replace(/[^0-9]/g, "");
  const rule = findNumberingRule(countryCode);
  if (rule === undefined) {
    return digits.slice(0, Math.max(0, MAX_E164_DIGITS - countryCode.length));
  }
  const national = digits.startsWith(rule.trunkPrefix)
    ? digits.slice(rule.trunkPrefix.length)
    : digits;
  return national.slice(0, rule.nationalLength);
};
