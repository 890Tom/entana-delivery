import { formatAmount } from "@entana/contracts";
import type { ReactElement, ReactNode } from "react";

import { texts } from "../../../i18n/texts";

import styles from "./order-details-card.module.css";

interface OrderDetailsCardProps {
  /** The card of the web layout asks for the day first; a phone does not show it. */
  readonly day: { readonly value: string; readonly line: string } | null;
  readonly landmark: string;
  readonly itemCount: number;
  readonly totalAr: number;
  /** The actions of the order: in the fixed bar on a phone, at the foot of the card otherwise. */
  readonly children: ReactNode;
}

/**
 * Where, how much and how to pay, and under it the actions. Every text that came from the
 * customer or the shop is rendered as text: no markup is ever interpreted.
 */
export function OrderDetailsCard({
  day,
  landmark,
  itemCount,
  totalAr,
  children,
}: OrderDetailsCardProps): ReactElement {
  const { details, dayCardLabel } = texts.tracking;
  return (
    <div className={styles.card}>
      {day !== null && (
        <div className={styles.day}>
          <span className={styles.muted}>{dayCardLabel}</span>
          <span className={styles.dayValue}>{day.value}</span>
          <span className={styles.muted}>{day.line}</span>
        </div>
      )}
      <div className={styles.details}>
        <span className={styles.landmark}>{landmark}</span>
        <span className={styles.muted}>
          {`${details.items(itemCount)}${texts.common.amountSeparator}${formatAmount(totalAr)}`}
        </span>
        <span className={styles.muted}>{details.payment}</span>
      </div>
      {children}
    </div>
  );
}
