import type { AdminOrderDetail } from "@entana/contracts";
import type { ReactElement } from "react";

import { texts } from "../../../i18n/texts";
import { formatAmount } from "../../orders/rules/format-order";

import card from "./card.module.css";
import styles from "./lines-card.module.css";

const t = texts.orderDetail.lines;

function Row({
  label,
  amount,
  isStrong = false,
}: {
  label: string;
  amount: number;
  isStrong?: boolean;
}): ReactElement {
  return (
    <div className={[styles.row, isStrong ? styles.strong : ""].join(" ")}>
      <dt>{label}</dt>
      <dd className={styles.amount}>{formatAmount(amount)}</dd>
    </div>
  );
}

/** The articles as they were ordered: read-only, prices frozen on the order. */
export function LinesCard({ order }: { order: AdminOrderDetail }): ReactElement {
  const count = order.lines.reduce((total, line) => total + line.quantity, 0);
  const subtotal = order.lines.reduce((total, line) => total + line.unitPriceAr * line.quantity, 0);
  return (
    <section aria-labelledby="lines-title" className={card.card}>
      <h2 id="lines-title" className={card.title}>
        {t.title}
      </h2>
      <ul className={styles.lines}>
        {order.lines.map((line) => (
          <li key={`${line.productName}-${String(line.unitPriceAr)}`} className={styles.line}>
            <div className={styles.name}>
              <p className={styles.product}>{line.productName}</p>
              <p className={card.muted}>{t.unitPrice(formatAmount(line.unitPriceAr))}</p>
            </div>
            <p className={styles.quantity}>{t.quantity(line.quantity)}</p>
            <p className={styles.amount}>{formatAmount(line.unitPriceAr * line.quantity)}</p>
          </li>
        ))}
      </ul>
      <dl className={styles.totals}>
        <Row label={t.subtotal(count)} amount={subtotal} />
        <Row label={t.delivery} amount={order.deliveryFeeAr} />
        <Row label={t.total} amount={order.totalAr} isStrong />
      </dl>
    </section>
  );
}
