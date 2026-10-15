/** delivery_fee and total_ar are PostgreSQL integers (signed 32 bits). */
export const MAX_AMOUNT_AR = 2_147_483_647;

export function doesAmountFitColumn(amountAr: number): boolean {
  return amountAr <= MAX_AMOUNT_AR;
}
