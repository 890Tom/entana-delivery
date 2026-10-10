import { extractNationalDigits, formatNationalNumber, parsePhoneNumber } from "@entana/contracts";
import type { PhoneRejectionReason } from "@entana/contracts";

/**
 * Why a number is refused, as far as the screen tells it: digits are missing, the number does
 * not start like an operator's, or it is simply not valid. The numbering rules are the
 * contract's: nothing here knows a prefix, a length or a grouping.
 */
export type PhoneIssue = "missing_digits" | "invalid_prefix" | "invalid";

export type PhoneCheck = { readonly ok: true } | { readonly ok: false; readonly issue: PhoneIssue };

const ISSUE_BY_REASON: Readonly<Record<PhoneRejectionReason, PhoneIssue>> = {
  too_short: "missing_digits",
  invalid_operator_prefix: "invalid_prefix",
  too_long: "invalid",
  invalid_characters: "invalid",
  country_not_accepted: "invalid",
};

/** Everything the field shows is made by this: the national digits of the text, then grouped. */
export function toPhoneDisplay(raw: string, countryCode: string): string {
  return formatNationalNumber(extractNationalDigits(raw, countryCode), countryCode);
}

/** The digits of a text that is already in the field's form (digits and formatting spaces). */
const digitsOf = (display: string): string => display.replace(/[^0-9]/g, "");

/** Checks what the field shows, as "+" and the country code and the digits: the server's rule. */
export function checkPhone(display: string, countryCode: string): PhoneCheck {
  const digits = digitsOf(display);
  if (digits === "") {
    // Nothing typed is not "missing digits": it is a number that was not given.
    return { ok: false, issue: "invalid" };
  }
  const result = parsePhoneNumber(`+${countryCode}${digits}`, countryCode);
  return result.ok ? { ok: true } : { ok: false, issue: ISSUE_BY_REASON[result.reason] };
}

interface PhoneEditInput {
  /** What the field holds right after the edit, before it is put in form. */
  readonly raw: string;
  /** Where the caret is in `raw`. */
  readonly caret: number;
  /** What the field showed before the edit. */
  readonly previousDisplay: string;
  /** The `inputType` of the input event, when the browser gives one. */
  readonly inputType: string | undefined;
  readonly countryCode: string;
}

export interface PhoneEdit {
  readonly digits: string;
  /** How many digits come before the caret: the caret's place that survives the formatting. */
  readonly caretDigits: number;
}

/**
 * The national digits after an edit of the field, and the caret's place in digits. A formatting
 * space that was deleted alone (the digits are the same as before) removes the neighbouring
 * digit instead: the one before the caret, or the one after it for a forward deletion.
 */
export function readPhoneEdit(edit: PhoneEditInput): PhoneEdit {
  const { raw, caret, previousDisplay, inputType, countryCode } = edit;
  const digits = extractNationalDigits(raw, countryCode);
  const caretDigits = Math.min(
    extractNationalDigits(raw.slice(0, caret), countryCode).length,
    digits.length,
  );
  const isDeletion = inputType === undefined || inputType.startsWith("delete");
  const isSpaceOnly =
    isDeletion && digits === digitsOf(previousDisplay) && raw.length < previousDisplay.length;
  if (!isSpaceOnly) {
    return { digits, caretDigits };
  }
  const isForward = inputType === "deleteContentForward";
  const index = isForward ? caretDigits : caretDigits - 1;
  if (index < 0 || index >= digits.length) {
    return { digits, caretDigits };
  }
  return {
    digits: digits.slice(0, index) + digits.slice(index + 1),
    caretDigits: isForward ? caretDigits : caretDigits - 1,
  };
}

/** The place in the shown text right after the given count of digits (0 for none). */
export function caretAfterDigits(display: string, digitCount: number): number {
  let seen = 0;
  for (let index = 0; index < display.length; index += 1) {
    if (seen === digitCount) {
      return index;
    }
    if (/[0-9]/.test(display.charAt(index))) {
      seen += 1;
    }
  }
  return display.length;
}
