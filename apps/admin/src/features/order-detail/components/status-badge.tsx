import type { AdminOrderDetail } from "@entana/contracts";
import type { ReactElement } from "react";

import { texts } from "../../../i18n/texts";
import { OrderIcon } from "../../../order-display/order-icons";
import { formatDay } from "../../../order-display/format-order";
import { STATUS_LOOKS } from "../rules/status-look";

import styles from "./status-badge.module.css";

/** The status as a pill: its text and its icon say it, the colour never does alone. */
export function StatusBadge({ order }: { order: AdminOrderDetail }): ReactElement {
  const look = STATUS_LOOKS[order.status];
  const label =
    order.status === "CONFIRMED" && order.deliveryDate !== null
      ? texts.orders.status.confirmedOn(formatDay(order.deliveryDate))
      : look.label;
  return (
    <span className={[styles.pill, styles[look.tone]].join(" ")}>
      <OrderIcon name={look.icon} size={16} />
      {label}
    </span>
  );
}
