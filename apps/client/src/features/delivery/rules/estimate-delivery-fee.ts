/**
 * The delivery fee shown to the customer, in ariary.
 * V1 : les frais sont fixés par la boutique à la confirmation de la commande ; phase 1b : quote() de contracts.
 * A display only: the fee is never sent to the API.
 */
export function estimateDeliveryFee(): number {
  return 0;
}
