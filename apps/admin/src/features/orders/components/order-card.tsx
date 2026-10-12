import type { AdminOrderListItem } from "@entana/contracts";
import type { ReactElement } from "react";

import { texts } from "../../../i18n/texts";
import { orderPath } from "../../../routes";
import { formatAmount, formatPhone, formatTime } from "../../../order-display/format-order";

import { ActionLink } from "./action-button";
import styles from "./order-card.module.css";

/** An order to handle: the code, the amount, who, and the way to its sheet. */
export function OrderCard({
  order,
  countryCode,
}: {
  order: AdminOrderListItem;
  countryCode: string | null;
}): ReactElement {
  const phone = countryCode === null ? order.phone : formatPhone(order.phone, countryCode);
  return (
    <li className={styles.card}>
      <div className={styles.head}>
        <div>
          <p className={styles.code}>#{order.publicCode}</p>
          <p className={styles.muted}>{texts.orders.receivedAt(formatTime(order.createdAt))}</p>
        </div>
        <p className={styles.total}>{formatAmount(order.totalAr)}</p>
      </div>
      <div className={styles.foot}>
        <div>
          <p className={styles.name}>
            {order.customerName}
            {order.isNewCustomer && (
              <span className={styles.badge}>{texts.orders.isNewCustomer}</span>
            )}
          </p>
          <p className={styles.muted}>
            {phone} · {texts.orders.articles(order.itemCount)}
          </p>
        </div>
        <ActionLink
          label={texts.orders.process}
          accessibleName={texts.orders.processLabel(order.publicCode)}
          variant="primary"
          href={orderPath(order.id)}
        />
      </div>
    </li>
  );
}
