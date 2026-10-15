import { normalizePhone } from "./normalize-phone.js";
import { findNumberingRule } from "./numbering-plan.js";
import type { NumberingRule } from "./numbering-plan.js";

/** Why a number is refused. A closed set: the result never holds a part of the input. */
export type PhoneRejectionReason =
  | "invalid_characters"
  | "too_long"
  | "too_short"
  | "invalid_operator_prefix"
  | "country_not_accepted";

export type PhoneParseResult =
  | {
      readonly ok: true;
      /** "+" and the digits, no separator: the one stored form, the key of a customer. */
      readonly e164: string;
      /** The digits after the country calling code. */
      readonly national: string;
    }
  | { readonly ok: false; readonly reason: PhoneRejectionReason };

const MAX_INPUT_LENGTH = 32;
// The digits of an E.164 number, country code included (what normalizePhone and the database say).
const MIN_DIGITS = 7;
const MAX_DIGITS = 15;
// One optional leading "+", then digits and the separators: no nested quantifier.
const ALLOWED_INPUT = /^\+?[0-9 ().-]*$/;

const countDigits = (input: string): number => input.replace(/[^0-9]/g, "").length;

// `normalizePhone` refused a text that only has allowed characters: tell why, from the digits.
// What is left is a form it never guesses (no "+" and no zero, a zero apart, a zero after the
// country code): the country of the number cannot be established.
const explainRefusal = (input: string): PhoneRejectionReason => {
  const digits = countDigits(input);
  if (digits < MIN_DIGITS) {
    return "too_short";
  }
  return digits > MAX_DIGITS ? "too_long" : "country_not_accepted";
};

const checkAgainstRule = (rule: NumberingRule, national: string): PhoneRejectionReason | null => {
  if (national.length < rule.nationalLength) {
    return "too_short";
  }
  if (national.length > rule.nationalLength) {
    return "too_long";
  }
  return rule.operatorPrefixes.some((prefix) => national.startsWith(prefix))
    ? null
    : "invalid_operator_prefix";
};

/**
 * Turns what a customer typed into the canonical number of the shop's country, or says why not.
 * The forms of input are `normalizePhone`'s own. For a country with a numbering rule, the number
 * must also be of that country and have the national digits of the rule; a country without a
 * rule keeps the generic validation. Total: it never throws, and the length is checked before
 * any pattern.
 */
export const parsePhoneNumber = (input: string, countryCode: string): PhoneParseResult => {
  if (input.length > MAX_INPUT_LENGTH) {
    return { ok: false, reason: "too_long" };
  }
  if (!ALLOWED_INPUT.test(input)) {
    return { ok: false, reason: "invalid_characters" };
  }
  const e164 = normalizePhone(input, countryCode);
  if (e164 === null) {
    return { ok: false, reason: explainRefusal(input) };
  }
  const digits = e164.slice(1);
  const isOfCountry = digits.startsWith(countryCode);
  const national = isOfCountry ? digits.slice(countryCode.length) : digits;
  const rule = findNumberingRule(countryCode);
  if (rule === undefined) {
    return { ok: true, e164, national };
  }
  if (!isOfCountry) {
    return { ok: false, reason: "country_not_accepted" };
  }
  const reason = checkAgainstRule(rule, national);
  return reason === null ? { ok: true, e164, national } : { ok: false, reason };
};
