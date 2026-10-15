import type { DeliveryQuoteResponse } from "@entana/contracts";

import { useCart } from "../../cart/cart-state/cart-context";
import { useDeliveryDraft } from "../delivery-draft/delivery-draft-context";

import { useRetainedQuote } from "./retained-quote";

/**
 * The quote retained for the point of the draft and the pieces of the cart as they are now, or
 * null: the screens after the delivery send the customer back to it, where it is asked again.
 */
export function useOrderQuote(): DeliveryQuoteResponse | null {
  const { point } = useDeliveryDraft();
  const { itemCount } = useCart();
  return useRetainedQuote(point, itemCount);
}
