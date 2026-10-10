import type { PublicProduct } from "@entana/contracts";
import { useEffect } from "react";

import { useCart } from "../cart-context";

/**
 * Once a catalogue is loaded, drops the lines whose product is missing or unavailable. An empty
 * catalogue proves nothing (it may be a mistake or a shop with nothing today): the cart stays.
 * The reducer returns the same state when nothing is removed, so a refresh changes nothing.
 */
export function useCartReconciliation(products: readonly PublicProduct[] | undefined): void {
  const { removeUnavailable } = useCart();
  useEffect(() => {
    if (products === undefined || products.length === 0) {
      return;
    }
    removeUnavailable(new Set(products.filter((p) => p.available).map((p) => p.id)));
  }, [products, removeUnavailable]);
}
