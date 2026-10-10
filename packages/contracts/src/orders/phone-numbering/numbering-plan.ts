/** How the national part of a number of one country is written and grouped. */
export interface NumberingRule {
  /** The count of national digits (the digits after the country calling code, no trunk zero). */
  readonly nationalLength: number;
  /** The first digits that an operator's mobile numbers start with. */
  readonly operatorPrefixes: readonly string[];
  /** The display grouping, in digits per group; the sum is `nationalLength`. */
  readonly grouping: readonly number[];
}

// ARTEC numbering plan, to be confirmed; change the prefixes here and in their tests.
// Mobile numbers only: nine national digits, two of operator then seven, shown as "34 12 345 67".
const MADAGASCAR_NATIONAL_LENGTH = 9;
const MADAGASCAR_OPERATOR_PREFIXES: readonly string[] = Object.freeze([
  "32",
  "33",
  "34",
  "37",
  "38",
  "39",
]);
const MADAGASCAR_GROUPING: readonly number[] = Object.freeze([2, 2, 3, 2]);

// By country calling code, without "+". A code that is not here has no rule: the generic
// validation of `normalizePhone` applies. Frozen, so that no caller can change the plan.
const NUMBERING_PLAN: Readonly<Record<string, NumberingRule>> = Object.freeze({
  "261": Object.freeze({
    nationalLength: MADAGASCAR_NATIONAL_LENGTH,
    operatorPrefixes: MADAGASCAR_OPERATOR_PREFIXES,
    grouping: MADAGASCAR_GROUPING,
  }),
});

/** The rule of a country calling code, or undefined when it has none. */
export const findNumberingRule = (countryCode: string): NumberingRule | undefined => {
  // Own keys only: "constructor" or "toString" is not a country.
  return Object.hasOwn(NUMBERING_PLAN, countryCode) ? NUMBERING_PLAN[countryCode] : undefined;
};
