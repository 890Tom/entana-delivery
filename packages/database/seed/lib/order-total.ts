export interface PricedLine {
  readonly qty: number;
  readonly unitPrice: number;
}

// Same rule as the server: items total + delivery fee, in whole ariary (docs/data-model.md).
export function computeOrderTotal(lines: readonly PricedLine[], deliveryFee: number): number {
  if (!Number.isInteger(deliveryFee) || deliveryFee < 0) {
    throw new RangeError("The delivery fee must be a non-negative integer.");
  }
  let total = deliveryFee;
  for (const { qty, unitPrice } of lines) {
    if (!Number.isInteger(qty) || qty <= 0) {
      throw new RangeError("A quantity must be a positive integer.");
    }
    if (!Number.isInteger(unitPrice) || unitPrice < 0) {
      throw new RangeError("A unit price must be a non-negative integer.");
    }
    total += qty * unitPrice;
  }
  return total;
}
