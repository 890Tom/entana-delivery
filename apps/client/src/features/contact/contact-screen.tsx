import { useId } from "react";
import type { DeliveryQuoteResponse } from "@entana/contracts";
import type { ReactElement } from "react";
import { Redirect } from "wouter";

import { BottomBar } from "../../components/bottom-bar/bottom-bar";
import bar from "../../components/bottom-bar/bottom-bar.module.css";
import { Notice } from "../../components/notice/notice";
import { texts } from "../../i18n/texts";
import { useDocumentTitle } from "../../layout/document-title/use-document-title";
import { CART_PATH, DELIVERY_PATH } from "../../routes";
import { useCart } from "../cart/cart-state/cart-context";
import { useCartReconciliation } from "../cart/reconciliation/use-cart-reconciliation";
import { useProducts } from "../catalogue/api/use-products";
import { useDeliveryDraft } from "../delivery/delivery-draft/delivery-draft-context";
import { useOrderQuote } from "../delivery/quote/use-order-quote";
import { isValidLandmark } from "../delivery/rules/validate-landmark";
import { OrderSummaryCard } from "../order-summary/order-summary-card";

import { ContactForm } from "./contact-form/contact-form";
import { useContactForm } from "./contact-form/use-contact-form";
import styles from "./contact-screen.module.css";

function ContactContent({
  hasRemovedUnavailable,
  deliveryQuote,
}: {
  hasRemovedUnavailable: boolean;
  deliveryQuote: DeliveryQuoteResponse;
}): ReactElement {
  const form = useContactForm();
  const formId = useId();
  return (
    <div className={styles.page}>
      <div className={styles.columns}>
        <div className={styles.main}>
          <h1 className={styles.title}>{texts.contact.heading}</h1>
          {hasRemovedUnavailable && <Notice tone="info">{texts.cart.removedUnavailable}</Notice>}
          <ContactForm id={formId} form={form} />
          {/* On a phone the notice follows the fields; from 1024 px it is in the side card. */}
          <div className={styles.phoneOnly}>
            <Notice tone="info">{texts.contact.dateNotice}</Notice>
          </div>
        </div>
        <div className={styles.side}>
          <OrderSummaryCard deliveryQuote={deliveryQuote}>
            <Notice tone="info">{texts.contact.dateNotice}</Notice>
            <button type="submit" form={formId} className={bar.link}>
              {texts.contact.continue}
            </button>
          </OrderSummaryCard>
        </div>
      </div>
      <BottomBar formId={formId} label={texts.contact.continue} />
    </div>
  );
}

/**
 * The name, the phone number and the note of the order, then the way on to the review. The
 * summary beside the form is only there from 1024 px, where it replaces the fixed bar.
 */
export function ContactScreen(): ReactElement {
  useDocumentTitle(texts.contact.title);
  const { itemCount, hasRemovedUnavailable } = useCart();
  const { point, landmark } = useDeliveryDraft();
  const deliveryQuote = useOrderQuote();
  const products = useProducts();
  // The same drop of the products that are no longer on sale as on the cart screen.
  useCartReconciliation(products.data?.products);
  if (itemCount === 0) {
    // Nothing to deliver: back to the cart, without leaving this address in the history.
    return <Redirect href={CART_PATH} replace />;
  }
  // No quote for this point and this cart (a reload, a changed cart): the delivery screen asks
  // again, from the draft, which stays as it is.
  if (point === null || !isValidLandmark(landmark) || deliveryQuote === null) {
    return <Redirect href={DELIVERY_PATH} replace />;
  }
  return (
    <ContactContent hasRemovedUnavailable={hasRemovedUnavailable} deliveryQuote={deliveryQuote} />
  );
}
