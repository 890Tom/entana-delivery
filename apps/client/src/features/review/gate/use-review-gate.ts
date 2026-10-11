import { useEffect, useState } from "react";

import { useCart } from "../../cart/cart-state/cart-context";
import { useContactDraft } from "../../contact/contact-draft/contact-draft-context";
import { useDeliveryDraft } from "../../delivery/delivery-draft/delivery-draft-context";
import { useInstance } from "../../instance/api/use-instance";
import { dismissOrderSubmission } from "../../order-submission/order-submission";
import type { OrderSubmissionState } from "../../order-submission/order-submission-types";

import { getReviewRedirect } from "../rules/get-review-redirect";

/** What the review does before showing anything. */
export type ReviewGate =
  | { readonly kind: "hold" }
  | { readonly kind: "tracking" }
  | { readonly kind: "redirect"; readonly href: string }
  | { readonly kind: "show" };

/**
 * Decides what the screen shows. The guards are off while a send goes on and once it is
 * confirmed: its success empties the cart and the drafts, and must not send the customer back.
 */
export function useReviewGate(state: OrderSubmissionState): ReviewGate {
  const { itemCount } = useCart();
  const delivery = useDeliveryDraft();
  const contact = useContactDraft();
  const countryCode = useInstance().data?.phoneCountryCode;
  const { status } = state;

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
  const href =
    status === "sending"
      ? null
      : getReviewRedirect({
          itemCount,
          hasPoint: delivery.point !== null,
          landmark: delivery.landmark,
          name: contact.name,
          phone: contact.phone,
          note: contact.note,
          countryCode,
        });
  return href === null ? { kind: "show" } : { kind: "redirect", href };
}
