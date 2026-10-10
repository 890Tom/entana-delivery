import { createContext, useContext } from "react";

import type { CartLine } from "./rules/cart-reducer";

export interface CartContextValue {
  readonly lines: readonly CartLine[];
  /** The sum of the quantities. */
  readonly itemCount: number;
  /** True when no further product can be added (the quantity of one already in can still grow). */
  readonly isFull: boolean;
  readonly hasRemovedUnavailable: boolean;
  readonly quantityOf: (productId: string) => number;
  readonly increase: (productId: string) => void;
  readonly decrease: (productId: string) => void;
  readonly removeUnavailable: (availableIds: ReadonlySet<string>) => void;
  /** Empties the cart (the order was sent). */
  readonly clear: () => void;
}

export const CART_CONTEXT = createContext<CartContextValue | null>(null);

export function useCart(): CartContextValue {
  const cart = useContext(CART_CONTEXT);
  if (cart === null) {
    throw new Error("useCart must be used inside a CartProvider");
  }
  return cart;
}
