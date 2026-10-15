import type { DeliveryQuoteResponse } from "@entana/contracts";
import { useEffect, useState } from "react";

import { useCart } from "../../cart/cart-state/cart-context";
import { useContactDraft } from "../../contact/contact-draft/contact-draft-context";
import { useDeliveryDraft } from "../../delivery/delivery-draft/delivery-draft-context";
import { useOrderQuote } from "../../delivery/quote/use-order-quote";
import { useInstance } from "../../instance/api/use-instance";
import { dismissOrderSubmission } from "../../order-submission/order-submission";
import type { OrderSubmissionState } from "../../order-submission/order-submission-types";

import { DELIVERY_PATH } from "../../../routes";
import { getReviewRedirect } from "../rules/get-review-redirect";

/** What the review does before showing anything. */
export type ReviewGate =
  | { readonly kind: "hold" }
  | { readonly kind: "tracking" }
  | { readonly kind: "redirect"; readonly href: string }
  | { readonly kind: "show"; readonly deliveryQuote: DeliveryQuoteResponse };

/** The screen to go back to when what the review needs is missing; none while a send goes on. */
function useGuardRedirect(isSending: boolean, hasDeliveryQuote: boolean): string | null {
  const { itemCount } = useCart();
  const delivery = useDeliveryDraft();
  const contact = useContactDraft();
  const countryCode = useInstance().data?.phoneCountryCode;
  if (isSending) {
    return null;
  }
  return getReviewRedirect({
    itemCount,
    hasPoint: delivery.point !== null,
    hasDeliveryQuote,
    landmark: delivery.landmark,
    name: contact.name,
    phone: contact.phone,
    note: contact.note,
    countryCode,
  });
}

/** Without a quote, the review goes back to the delivery screen, which asks for it again. */
function showOrRedirect(
  href: string | null,
  deliveryQuote: DeliveryQuoteResponse | null,
): ReviewGate {
  if (href === null && deliveryQuote !== null) {
    return { kind: "show", deliveryQuote };
  }
  return { kind: "redirect", href: href ?? DELIVERY_PATH };
}

/**
 * Decides what the screen shows. The guards are off while a send goes on and once it is
 * confirmed: its success empties the cart and the drafts, and must not send the customer back.
 */
export function useReviewGate(state: OrderSubmissionState): ReviewGate {
  const { itemCount } = useCart();
  const deliveryQuote = useOrderQuote();
  const { status } = state;
  const href = useGuardRedirect(status === "sending", deliveryQuote !== null);

  // True once this screen has seen the send: the emptying of the cart is then its own doing.
  const [hasSentHere, setHasSentHere] = useState(false);
  if (status === "sending" && !hasSentHere) {
    setHasSentHere(true);
  }
  // A confirmation, with something in the cart that this screen did not send: a new order has
  // begun, and the old confirmation is forgotten before the guards apply.
  const isOldConfirmation = status === "confirmed" && itemCount > 0 && !hasSentHere;
  useEffect(() => {
    if (isOldConfirmation) {
      dismissOrderSubmission();
    }
  }, [isOldConfirmation]);

  if (isOldConfirmation) {
    return { kind: "hold" };
  }
  if (status === "confirmed") {
    return { kind: "tracking" };
  }
  return showOrRedirect(href, deliveryQuote);
}
