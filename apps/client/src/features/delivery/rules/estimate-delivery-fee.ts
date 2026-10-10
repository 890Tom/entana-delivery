/**
 * The delivery fee shown to the customer, in ariary.
 * V1: the shop sets the fee when it confirms the order; phase 1b: quote() from contracts.
 * A display only: the fee is never sent to the API.
 */
export function estimateDeliveryFee(): number {
  return 0;
}
