import { useId, useRef } from "react";
import type { ReactElement } from "react";

import bar from "../../../components/bottom-bar/bottom-bar.module.css";
import { Notice } from "../../../components/notice/notice";
import { texts } from "../../../i18n/texts";
import { useProducts } from "../../catalogue/api/use-products";
import { useCart } from "../../cart/cart-state/cart-context";
import { useContactDraft } from "../../contact/contact-draft/contact-draft-context";
import { toPhoneDisplay } from "../../contact/rules/phone-input";
import { useDeliveryDraft } from "../../delivery/delivery-draft/delivery-draft-context";
import { useInstance } from "../../instance/api/use-instance";
import type { OrderSubmission } from "../../order-submission/use-order-submission";
import { OrderSummaryCard } from "../../order-summary/order-summary-card";

import { DeliveryRecapCard } from "../delivery-recap/delivery-recap-card";
import styles from "../review-screen.module.css";
import { SendControls } from "./send-controls";
import { useReviewNotice } from "../notice/use-review-notice";

/** The page heading (one per width, the other `display: none`) and the notice of the cart. */
function PageHead(): ReactElement {
  const { hasRemovedUnavailable } = useCart();
  return (
    <div className={styles.head}>
      <h1 className={[styles.title, styles.narrowOnly].join(" ")}>{texts.review.headingNarrow}</h1>
      <h1 className={[styles.title, styles.wideOnly].join(" ")}>{texts.review.headingWide}</h1>
      {hasRemovedUnavailable && <Notice tone="info">{texts.cart.removedUnavailable}</Notice>}
    </div>
  );
}

/** The card of the delivery: the number needs the country code, which the instance holds. */
function Recap(): ReactElement {
  const delivery = useDeliveryDraft();
  const contact = useContactDraft();
  const countryCode = useInstance().data?.phoneCountryCode;
  const phone =
    countryCode === undefined
      ? null
      : `+${countryCode} ${toPhoneDisplay(contact.phone, countryCode)}`;
  return (
    <DeliveryRecapCard
      landmark={delivery.landmark}
      name={contact.name}
      phone={phone}
      note={contact.note}
    />
  );
}

/** The amounts, with the button of the web layout inside the card (`display: none` on a phone). */
function Amounts(props: {
  readonly formId: string;
  readonly isInactive: boolean;
  readonly isSending: boolean;
}): ReactElement {
  return (
    <OrderSummaryCard title={{ narrow: texts.review.itemsTitle, wide: texts.review.summaryTitle }}>
      <button
        type="submit"
        form={props.formId}
        className={[bar.link, styles.sendInCard].join(" ")}
        aria-disabled={props.isInactive ? true : undefined}
        aria-busy={props.isSending ? true : undefined}
      >
        {texts.review.send}
      </button>
    </OrderSummaryCard>
  );
}

/**
 * The review, in the order of the keyboard: title, the card of the delivery (its links), the
 * payment, then the amounts with their button, then the error. The look is made by the grid.
 */
export function ReviewContent({ submission }: { submission: OrderSubmission }): ReactElement {
  const instance = useInstance();
  const products = useProducts();
  const formId = useId();
  const noticeRef = useRef<HTMLDivElement>(null);
  const notice = useReviewNotice(submission, noticeRef);
  const isSending = submission.state.status === "sending";
  // A customer must see the total before sending: both are known, and nothing is sent twice.
  const isInactive = isSending || !instance.isSuccess || !products.isSuccess;
  return (
    <div className={styles.page}>
      <div className={styles.grid}>
        <PageHead />
        <div className={styles.recap}>
          <Recap />
        </div>
        <div className={styles.payment}>
          <Notice tone="info">{texts.review.payment}</Notice>
        </div>
        <div className={styles.summary}>
          <Amounts formId={formId} isInactive={isInactive} isSending={isSending} />
        </div>
        {notice !== null && <div className={styles.error}>{notice}</div>}
      </div>
      <SendControls
        formId={formId}
        isInactive={isInactive}
        isSending={isSending}
        onSend={submission.send}
      />
    </div>
  );
}
