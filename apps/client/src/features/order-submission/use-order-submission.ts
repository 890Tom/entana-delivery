import { useEffect, useRef, useSyncExternalStore } from "react";

import { useCart } from "../cart/cart-state/cart-context";
import { useContactDraft } from "../contact/contact-draft/contact-draft-context";
import { useDeliveryDraft } from "../delivery/delivery-draft/delivery-draft-context";
import { useInstance } from "../instance/use-instance";
import { useClearOrderDrafts } from "../order-draft/use-clear-order-drafts";

import {
  attachOrderSubmissionHost,
  dismissOrderSubmission,
  getOrderSubmissionState,
  retryOrder,
  submitOrder,
  subscribeToOrderSubmission,
} from "./order-submission";
import type { OrderSubmissionState } from "./order-submission-types";

export interface OrderSubmission {
  /** No text: the screen chooses its words from the type, the fields or the product ids. */
  readonly state: OrderSubmissionState;
  /** Sends the order made of the cart and the drafts. */
  readonly send: () => void;
  /** Sends the stored attempt again, identically. */
  readonly retry: () => void;
}

export function useOrderSubmission(): OrderSubmission {
  const cart = useCart();
  const delivery = useDeliveryDraft();
  const contact = useContactDraft();
  const instance = useInstance();
  const clearDrafts = useClearOrderDrafts();
  const state = useSyncExternalStore(subscribeToOrderSubmission, getOrderSubmissionState);
  const cleanup = { clearDrafts, clearCart: cart.clear };
  const drafts = {
    lines: cart.lines,
    point: delivery.point,
    landmark: delivery.landmark,
    name: contact.name,
    phone: contact.phone,
    note: contact.note,
    countryCode: instance.data?.phoneCountryCode,
  };

  // What the module reads at the return of the network: the screens as they are by then, not as
  // they were when the order failed. Declared while this hook is mounted, and only then.
  const latest = useRef({ drafts, cleanup });
  useEffect(() => {
    latest.current = { drafts, cleanup };
  });
  useEffect(() => {
    const detach = attachOrderSubmissionHost({ read: () => latest.current });
    return () => {
      detach();
      // A failure is forgotten with the screen; a confirmed order is not (see the dismiss).
      if (getOrderSubmissionState().status !== "confirmed") {
        dismissOrderSubmission();
      }
    };
  }, []);

  return {
    state,
    send: () => {
      void submitOrder(drafts, cleanup);
    },
    retry: () => {
      void retryOrder(cleanup);
    },
  };
}
