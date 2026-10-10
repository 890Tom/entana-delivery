import { findNumberingRule } from "./numbering-plan.js";

/**
 * The longest count of national digits of a country, or null when its plan has no rule (and so
 * no maximum). For an input field that must stop typing at the end of a number.
 */
export const maxNationalDigits = (countryCode: string): number | null => {
  return findNumberingRule(countryCode)?.nationalLength ?? null;
};

/**
 * National digits, possibly partial, grouped for display: "341234" gives "34 12 34". Digits past
 * the longest number are dropped. Without a rule the digits are returned unchanged. Pure and
 * total; it is a display only, never what is stored.
 */
export const formatNationalNumber = (digits: string, countryCode: string): string => {
  const rule = findNumberingRule(countryCode);
  if (rule === undefined) {
    return digits;
  }
  const kept = digits.replace(/[^0-9]/g, "").slice(0, rule.nationalLength);
  const groups: string[] = [];
  let start = 0;
  for (const size of rule.grouping) {
    if (start >= kept.length) {
      break;
    }
    groups.push(kept.slice(start, start + size));
    start += size;
  }
  return groups.join(" ");
};
