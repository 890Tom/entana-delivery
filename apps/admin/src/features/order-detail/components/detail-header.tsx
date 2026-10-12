import type { AdminOrderDetail } from "@entana/contracts";
import type { ReactElement } from "react";
import { Link } from "wouter";

import { texts } from "../../../i18n/texts";
import { ORDERS_PATH } from "../../../routes";
import { OrderIcon } from "../../../order-display/order-icons";
import { describeInstant } from "../rules/format-detail";

import styles from "./detail-header.module.css";
import { StatusBadge } from "./status-badge";

const t = texts.orderDetail;

function receivedText(order: AdminOrderDetail, now: Date): string {
  const view = describeInstant(order.createdAt, now);
  switch (view.relation) {
    case "today":
      return t.receivedToday(view.time);
    case "yesterday":
      return t.receivedYesterday(view.time);
    case "other":
      return t.receivedOn(view.date, view.time);
  }
}

/** The way back to the list, shown by every state of the sheet. */
export function BackLink(): ReactElement {
  return (
    <Link href={ORDERS_PATH} className={styles.back}>
      <OrderIcon name="arrow-left" size={20} />
      {t.back}
    </Link>
  );
}

/** The back link, then the code, the status and the time of arrival. No actions menu. */
export function DetailHeader({ order, now }: { order: AdminOrderDetail; now: Date }): ReactElement {
  return (
    <header className={styles.header}>
      <BackLink />
      <div className={styles.title}>
        <h1 className={styles.heading}>{t.title(order.publicCode)}</h1>
        <StatusBadge order={order} />
        <p className={styles.received}>{receivedText(order, now)}</p>
      </div>
    </header>
  );
}
