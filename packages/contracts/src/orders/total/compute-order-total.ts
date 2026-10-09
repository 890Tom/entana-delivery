export interface OrderLineAmount {
  readonly unitPrice: number;
  readonly quantity: number;
}

const assertSafeInteger = (value: number, name: string): void => {
  if (!Number.isSafeInteger(value)) {
    throw new RangeError(`${name} must be a safe integer`);
  }
};

const computeLineAmount = (line: OrderLineAmount): number => {
  assertSafeInteger(line.unitPrice, "unitPrice");
  assertSafeInteger(line.quantity, "quantity");
  if (line.unitPrice < 0) {
    throw new RangeError("unitPrice must not be negative");
  }
  if (line.quantity < 1) {
    throw new RangeError("quantity must be at least 1");
  }
  const amount = line.unitPrice * line.quantity;
  // A product above 2^53 is rounded, so it can only be detected, never corrected.
  assertSafeInteger(amount, "a line amount");
  return amount;
};

/**
 * The total of an order in ariary: the lines plus the delivery fee. Money is an integer.
 * A price of 0 is allowed, a quantity of 0 is not (the database requires qty > 0).
 *
 * @throws RangeError for a non-integer, negative or non-finite amount, an empty list, or a
 * total above Number.MAX_SAFE_INTEGER. The message never repeats the values.
 */
export const computeOrderTotal = (
  lines: readonly OrderLineAmount[],
  deliveryFee: number,
): number => {
  if (lines.length === 0) {
    throw new RangeError("an order needs at least one line");
  }
  assertSafeInteger(deliveryFee, "deliveryFee");
  if (deliveryFee < 0) {
    throw new RangeError("deliveryFee must not be negative");
  }
  let total = deliveryFee;
  for (const line of lines) {
    total += computeLineAmount(line);
    assertSafeInteger(total, "the total");
  }
  return total;
};
