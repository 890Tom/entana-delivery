/**
 * Formats an amount in ariary with a non-breaking space as thousands separator,
 * for example 1500 -> "1 500 Ar". Ariary has no decimals in this application.
 */
export function formatAmount(amountAr: number): string {
  if (!Number.isInteger(amountAr) || amountAr < 0) {
    throw new RangeError("The amount must be a non-negative integer.");
  }
  const grouped = amountAr.toString().replace(/\B(?=(\d{3})+(?!\d))/g, "\u00a0");
  return `${grouped}\u00a0Ar`;
}
