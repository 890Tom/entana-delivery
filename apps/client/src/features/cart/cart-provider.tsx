import { useEffect, useMemo, useReducer, useRef } from "react";
import type { ReactElement, ReactNode } from "react";

import { CART_CONTEXT } from "./cart-context";
import type { CartContextValue } from "./cart-context";
import { MAX_CART_PRODUCTS } from "./cart-limits";
import { cartReducer, emptyCart } from "./cart-reducer";
import { readStoredCart, serializeCart, writeStoredCart } from "./cart-storage";

type CartActions = Pick<CartContextValue, "increase" | "decrease" | "removeUnavailable">;

/** Reads the cart once at start, and writes it after each change that alters what is stored. */
export function CartProvider({ children }: { children: ReactNode }): ReactElement {
  const [state, dispatch] = useReducer(cartReducer, undefined, () => emptyCart(readStoredCart()));
  const lastStored = useRef(serializeCart(state.lines));

  useEffect(() => {
    const serialized = serializeCart(state.lines);
    if (serialized !== lastStored.current) {
      lastStored.current = serialized;
      writeStoredCart(state.lines);
    }
  }, [state.lines]);

  // Stable, so that an effect depending on an action does not run again at each cart change.
  const actions = useMemo<CartActions>(
    () => ({
      increase: (productId) => {
        dispatch({ type: "increase", productId });
      },
      decrease: (productId) => {
        dispatch({ type: "decrease", productId });
      },
      removeUnavailable: (availableIds) => {
        dispatch({ type: "removeUnavailable", availableIds });
      },
    }),
    [],
  );

  const value = useMemo<CartContextValue>(
    () => ({
      ...actions,
      lines: state.lines,
      itemCount: state.lines.reduce((sum, line) => sum + line.quantity, 0),
      isFull: state.lines.length >= MAX_CART_PRODUCTS,
      hasRemovedUnavailable: state.hasRemovedUnavailable,
      quantityOf: (productId) =>
        state.lines.find((line) => line.productId === productId)?.quantity ?? 0,
    }),
    [actions, state],
  );
  return <CART_CONTEXT value={value}>{children}</CART_CONTEXT>;
}
