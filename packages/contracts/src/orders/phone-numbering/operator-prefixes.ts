import { findNumberingRule } from "./numbering-plan.js";

/**
 * The first digits of the mobile numbers of a country, for a message that tells what a number
 * must start with. Empty for a country without a rule. A frozen list: a caller cannot change it.
 */
export const operatorPrefixes = (countryCode: string): readonly string[] => {
  return findNumberingRule(countryCode)?.operatorPrefixes ?? [];
};
