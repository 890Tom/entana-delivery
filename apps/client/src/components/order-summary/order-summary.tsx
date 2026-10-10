import { formatAmount } from "@entana/contracts";
import { useId } from "react";
import type { ReactElement, ReactNode } from "react";

import { texts } from "../../i18n/texts";
import { DeliveryFeeLine } from "../delivery-fee-line/delivery-fee-line";
import { Notice } from "../notice/notice";
import visuallyHidden from "../visually-hidden/visually-hidden.module.css";

import styles from "./order-summary.module.css";

interface OrderSummaryLine {
  readonly id: string;
  readonly name: string;
  readonly quantity: number;
  /** The price of the whole line, in ariary. */
  readonly amountAr: number;
}

/** What the card shows in its body: the lines are not known yet, failed, or are known. */
export type OrderSummaryContent =
  | { readonly status: "loading" }
  | { readonly status: "failed"; readonly message: string; readonly onRetry: () => void }
  | { readonly status: "empty" }
  | {
      readonly status: "ready";
      readonly lines: readonly OrderSummaryLine[];
      readonly deliveryFeeAr: number;
      readonly totalAr: number;
    };

// The shape of the loaded card: two lines, the delivery row and the total.
const SKELETON_LINE_COUNT = 2;
const SKELETON_LINES = Array.from({ length: SKELETON_LINE_COUNT }, (_unused, index) => index);

function SummarySkeleton(): ReactElement {
  return (
    <div aria-busy="true" className={styles.skeleton}>
      <span className={visuallyHidden.visuallyHidden}>{texts.common.loading}</span>
      <div aria-hidden="true" className={styles.skeleton}>
        {SKELETON_LINES.map((index) => (
          <div key={index} className={styles.block} />
        ))}
        <div className={styles.block} />
        <div className={[styles.block, styles.totalBlock].join(" ")} />
      </div>
    </div>
  );
}

function SummaryLines({
  content,
}: {
  content: Extract<OrderSummaryContent, { status: "ready" }>;
}): ReactElement {
  return (
    <>
      <ul className={styles.lines}>
        {content.lines.map((line) => (
          <li key={line.id} className={styles.line}>
            <span>
              {line.name}{" "}
              <span className={styles.quantity}>{texts.orderSummary.quantity(line.quantity)}</span>
            </span>
            <span className={styles.amount}>{formatAmount(line.amountAr)}</span>
          </li>
        ))}
      </ul>
      <DeliveryFeeLine amountAr={content.deliveryFeeAr} variant="plain" />
      <p className={styles.total}>
        <span className={styles.totalLabel}>{texts.orderSummary.total}</span>
        <span className={styles.totalAmount}>{formatAmount(content.totalAr)}</span>
      </p>
    </>
  );
}

function SummaryBody({ content }: { content: OrderSummaryContent }): ReactElement | null {
  switch (content.status) {
    case "loading":
      return <SummarySkeleton />;
    case "failed":
      return (
        <Notice tone="error" action={{ label: texts.common.retry, onClick: content.onRetry }}>
          {content.message}
        </Notice>
      );
    case "empty":
      return null;
    case "ready":
      return <SummaryLines content={content} />;
  }
}

/**
 * The recap card of an order: its lines, the delivery row and the total, then what the screen
 * puts under them (a notice, the primary button). It is the same on every screen of the order
 * that shows it. Each state is built on the loaded layout, so that nothing moves.
 */
export function OrderSummary({
  content,
  children,
}: {
  content: OrderSummaryContent;
  children?: ReactNode;
}): ReactElement {
  const titleId = useId();
  return (
    <section aria-labelledby={titleId} className={styles.card}>
      <h2 id={titleId} className={styles.title}>
        {texts.orderSummary.title}
      </h2>
      <SummaryBody content={content} />
      {children}
    </section>
  );
}
