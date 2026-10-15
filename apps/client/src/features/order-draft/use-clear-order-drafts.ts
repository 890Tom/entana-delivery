import { useContactDraft } from "../contact/contact-draft/contact-draft-context";
import { useDeliveryDraft } from "../delivery/delivery-draft/delivery-draft-context";
import { forgetDeliveryQuote } from "../delivery/quote/retained-quote";

/**
 * The one way to forget what the customer typed for an order: the delivery draft and the contact
 * draft, in memory and in the storage, and the quote of the point. To be called once the order is
 * sent.
 */
export function useClearOrderDrafts(): () => void {
  const delivery = useDeliveryDraft();
  const contact = useContactDraft();
  return () => {
    delivery.clear();
    contact.clear();
    forgetDeliveryQuote();
  };
}
